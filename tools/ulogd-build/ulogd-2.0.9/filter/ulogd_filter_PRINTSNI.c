/*
 * ulogd_filter_PRINTSNI.c
 *
 * ulogd filter plugin that extracts TLS SNI (Server Name Indication)
 * from TLS ClientHello messages in raw packet data.
 *
 * This allows logging of which TLS/HTTPS domains clients are connecting to,
 * which is extremely useful for hotspot/captive portal analytics.
 *
 * Stack usage example:
 *   stack=sni:NFLOG,sni_base:BASE,sni_sni:PRINTSNI,sni_json:JSON
 *
 * (C) 2024 - Based on ulogd_filter_PRINTPKT.c by Philip Craig
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License version 2
 *  as published by the Free Software Foundation
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/ip.h>
#include <netinet/ip6.h>
#include <netinet/tcp.h>
#include <ulogd/ulogd.h>
#include <ulogd/printpkt.h>

/* Maximum SNI hostname length (RFC 1035: 253 chars max) */
#define PRINTSNI_MAX_SNI_LEN 256

/* Maximum JSON-formatted SNI output buffer */
#define PRINTSNI_MAX_BUF 512

/* TLS Content Types */
#define TLS_CONTENT_TYPE_CHANGE_CIPHER_SPEC 20
#define TLS_CONTENT_TYPE_ALERT              21
#define TLS_CONTENT_TYPE_HANDSHAKE          22
#define TLS_CONTENT_TYPE_APPLICATION_DATA   23

/* TLS Handshake Types */
#define TLS_HANDSHAKE_CLIENT_HELLO 1

/* TLS Extension Types */
#define TLS_EXT_SERVER_NAME 0

/*
 * Minimal TLS parser - extract SNI from raw packet payload.
 * Returns 0 on success (sni found), -1 if not a TLS ClientHello
 * or SNI not present.
 */
static int extract_sni_from_payload(const uint8_t *payload, uint32_t payload_len,
                                     char *sni_buf, uint32_t sni_buf_len)
{
    const uint8_t *p = payload;
    const uint8_t *end = payload + payload_len;
    uint16_t tls_version;
    uint32_t handshake_len;
    uint16_t client_version;
    uint32_t session_id_len;
    uint16_t cipher_suites_len;
    uint8_t compression_methods_len;
    uint16_t extensions_len;
    const uint8_t *extensions;
    const uint8_t *ext_end;

    /* We need at least 43 bytes for minimal TLS record + ClientHello header */
    if (payload_len < 43)
        return -1;

    /* Check TLS record header: ContentType(1) + Version(2) + Length(2) = 5 bytes */
    if (p[0] != TLS_CONTENT_TYPE_HANDSHAKE)
        return -1;

    tls_version = (p[1] << 8) | p[2];
    /* Accept TLS 1.0 (0x0301), TLS 1.1 (0x0302), TLS 1.2 (0x0303), TLS 1.3 (0x0303 for CH) */
    if ((tls_version & 0xFF00) != 0x0300)
        return -1;

    uint16_t record_len = (p[3] << 8) | p[4];
    p += 5;

    /* Make sure we don't read past the record */
    if (p + record_len > end)
        record_len = end - p;

    if (record_len < 4)
        return -1;

    /* Handshake: Type(1) + Length(3) */
    if (p[0] != TLS_HANDSHAKE_CLIENT_HELLO)
        return -1;

    handshake_len = ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | p[3];
    p += 4;

    /* Bounds check for handshake message */
    if (p + handshake_len > end)
        handshake_len = end - p;

    if (handshake_len < 34)
        return -1;

    /* ClientHello: client_version(2) + random(32) */
    client_version = (p[0] << 8) | p[1];
    p += 34; /* skip version(2) + random(32) */

    if (p >= end)
        return -1;

    /* session_id_length(1) */
    session_id_len = p[0];
    p += 1 + session_id_len;

    if (p + 2 > end)
        return -1;

    /* cipher_suites_length(2) */
    cipher_suites_len = (p[0] << 8) | p[1];
    p += 2 + cipher_suites_len;

    if (p >= end)
        return -1;

    /* compression_methods_length(1) */
    compression_methods_len = p[0];
    p += 1 + compression_methods_len;

    if (p + 2 > end)
        return -1;

    /* extensions_length(2) - only present if we have TLS 1.2+ or extensions follow */
    extensions_len = (p[0] << 8) | p[1];
    p += 2;

    extensions = p;
    ext_end = extensions + extensions_len;

    /* Bounds check */
    if (ext_end > end)
        ext_end = end;

    /* Walk through extensions looking for SNI (type 0x0000) */
    while (p + 4 <= ext_end) {
        uint16_t ext_type = (p[0] << 8) | p[1];
        uint16_t ext_len = (p[2] << 8) | p[3];
        p += 4;

        if (p + ext_len > ext_end)
            break;

        if (ext_type == TLS_EXT_SERVER_NAME) {
            const uint8_t *sni_data = p;
            const uint8_t *sni_end = p + ext_len;

            if (sni_data + 2 > sni_end)
                return -1;

            /* Server Name list length (2 bytes) */
            /* sni_data[0..1] = server_name_list_length */
            const uint8_t *p_sni_list = sni_data + 2;

            if (p_sni_list + 3 > sni_end)
                return -1;

            /* Server Name Type (1 byte): 0 = hostname */
            uint8_t name_type = p_sni_list[0];
            if (name_type != 0)
                return -1;

            /* Server Name Length (2 bytes) */
            uint16_t name_len = (p_sni_list[1] << 8) | p_sni_list[2];
            const uint8_t *name_start = p_sni_list + 3;

            if (name_start + name_len > sni_end)
                return -1;

            /* Copy SNI to output buffer, null-terminate */
            uint32_t copy_len = name_len;
            if (copy_len >= sni_buf_len)
                copy_len = sni_buf_len - 1;

            memcpy(sni_buf, name_start, copy_len);
            sni_buf[copy_len] = '\0';

            /* Validate: SNI should be printable ASCII */
            for (uint32_t i = 0; i < copy_len; i++) {
                if (sni_buf[i] < 0x20 || sni_buf[i] > 0x7E) {
                    sni_buf[0] = '\0';
                    return -1;
                }
            }

            return 0; /* Success! */
        }

        p += ext_len;
    }

    return -1; /* SNI extension not found */
}

/*
 * Get TCP payload from raw packet (after IP + TCP headers).
 * Works for both IPv4 and IPv6.
 */
static const uint8_t *get_tcp_payload(struct ulogd_pluginstance *pi,
                                       uint32_t *payload_len_out)
{
    struct ulogd_key *inp = pi->input.keys;
    uint32_t pktlen = ikey_get_u32(&inp[1]); /* raw.pktlen */
    uint8_t family = ikey_get_u8(&inp[2]);   /* oob.family */
    const uint8_t *pkt = ikey_get_ptr(&inp[0]); /* raw.pkt */
    uint32_t ip_hdr_len;
    uint32_t tcp_hdr_len;
    const uint8_t *tcp_hdr;

    if (!pkt || pktlen < sizeof(struct iphdr))
        return NULL;

    if (family == AF_INET) {
        struct iphdr *iph = (struct iphdr *)pkt;
        if (iph->protocol != IPPROTO_TCP)
            return NULL;
        ip_hdr_len = iph->ihl * 4;
    } else if (family == AF_INET6) {
        struct ip6_hdr *ip6h = (struct ip6_hdr *)pkt;
        /* For IPv6, find TCP in next header - simplified: assume no extensions */
        if (ip6h->ip6_nxt != IPPROTO_TCP)
            return NULL;
        ip_hdr_len = sizeof(struct ip6_hdr);
    } else if (family == AF_BRIDGE) {
        /* For bridged packets, skip Ethernet header (14 bytes) */
        if (pktlen < 14 + sizeof(struct iphdr))
            return NULL;
        uint16_t eth_proto = (pkt[12] << 8) | pkt[13];
        if (eth_proto == 0x0800) { /* IPv4 */
            struct iphdr *iph = (struct iphdr *)(pkt + 14);
            if (iph->protocol != IPPROTO_TCP)
                return NULL;
            ip_hdr_len = 14 + iph->ihl * 4;
        } else if (eth_proto == 0x86DD) { /* IPv6 */
            struct ip6_hdr *ip6h = (struct ip6_hdr *)(pkt + 14);
            if (ip6h->ip6_nxt != IPPROTO_TCP)
                return NULL;
            ip_hdr_len = 14 + sizeof(struct ip6_hdr);
        } else {
            return NULL;
        }
    } else {
        return NULL;
    }

    if (pktlen <= ip_hdr_len + sizeof(struct tcphdr))
        return NULL;

    tcp_hdr = pkt + ip_hdr_len;
    tcp_hdr_len = ((struct tcphdr *)tcp_hdr)->doff * 4;

    if (tcp_hdr_len < sizeof(struct tcphdr))
        return NULL;

    if (pktlen <= ip_hdr_len + tcp_hdr_len)
        return NULL;

    *payload_len_out = pktlen - ip_hdr_len - tcp_hdr_len;
    return tcp_hdr + tcp_hdr_len;
}

/* Input keys - same as BASE raw2packet input */
enum sni_in_keys {
    SNI_INKEY_RAW_PCKT,
    SNI_INKEY_RAW_PCKTLEN,
    SNI_INKEY_OOB_FAMILY,
    SNI_INKEY_OOB_PROTOCOL,
};

/* Output keys */
enum sni_out_keys {
    SNI_OUT_SNI_HOSTNAME,
    SNI_OUT_TLS_VERSION,
    SNI_OUT_PRINT,
};

static struct ulogd_key sni_inp[] = {
    [SNI_INKEY_RAW_PCKT] = {
        .type = ULOGD_RET_RAW,
        .name = "raw.pkt",
    },
    [SNI_INKEY_RAW_PCKTLEN] = {
        .type = ULOGD_RET_UINT32,
        .name = "raw.pktlen",
    },
    [SNI_INKEY_OOB_FAMILY] = {
        .type = ULOGD_RET_UINT8,
        .name = "oob.family",
    },
    [SNI_INKEY_OOB_PROTOCOL] = {
        .type = ULOGD_RET_UINT16,
        .name = "oob.protocol",
    },
};

static struct ulogd_key sni_outp[] = {
    [SNI_OUT_SNI_HOSTNAME] = {
        .type = ULOGD_RET_STRING,
        .flags = ULOGD_RETF_NONE,
        .name = "sni.hostname",
    },
    [SNI_OUT_TLS_VERSION] = {
        .type = ULOGD_RET_STRING,
        .flags = ULOGD_RETF_NONE,
        .name = "sni.tls.version",
    },
    [SNI_OUT_PRINT] = {
        .type = ULOGD_RET_STRING,
        .flags = ULOGD_RETF_NONE,
        .name = "sni.print",
    },
};

static char sni_hostname[PRINTSNI_MAX_SNI_LEN];
static char sni_tls_version[16];
static char sni_print_buf[PRINTSNI_MAX_BUF];

static int printsni_interp(struct ulogd_pluginstance *upi)
{
    struct ulogd_key *ret = upi->output.keys;
    uint32_t payload_len;
    const uint8_t *payload;

    sni_hostname[0] = '\0';
    sni_tls_version[0] = '\0';
    sni_print_buf[0] = '\0';

    payload = get_tcp_payload(upi, &payload_len);
    if (!payload || payload_len == 0) {
        okey_set_ptr(&ret[SNI_OUT_SNI_HOSTNAME], sni_hostname);
        okey_set_ptr(&ret[SNI_OUT_TLS_VERSION], sni_tls_version);
        okey_set_ptr(&ret[SNI_OUT_PRINT], sni_print_buf);
        return ULOGD_IRET_OK;
    }

    /* Quick check: must start with TLS Handshake content type (0x16) */
    if (payload[0] != TLS_CONTENT_TYPE_HANDSHAKE) {
        okey_set_ptr(&ret[SNI_OUT_SNI_HOSTNAME], sni_hostname);
        okey_set_ptr(&ret[SNI_OUT_TLS_VERSION], sni_tls_version);
        okey_set_ptr(&ret[SNI_OUT_PRINT], sni_print_buf);
        return ULOGD_IRET_OK;
    }

    /* Extract TLS version from record header */
    if (payload_len >= 3) {
        uint16_t ver = (payload[1] << 8) | payload[2];
        switch (ver) {
            case 0x0301: snprintf(sni_tls_version, sizeof(sni_tls_version), "TLSv1.0"); break;
            case 0x0302: snprintf(sni_tls_version, sizeof(sni_tls_version), "TLSv1.1"); break;
            case 0x0303: snprintf(sni_tls_version, sizeof(sni_tls_version), "TLSv1.2"); break;
            default:     snprintf(sni_tls_version, sizeof(sni_tls_version), "0x%04x", ver); break;
        }
    }

    /* Try to extract SNI */
    if (extract_sni_from_payload(payload, payload_len,
                                  sni_hostname, PRINTSNI_MAX_SNI_LEN) == 0) {
        snprintf(sni_print_buf, PRINTSNI_MAX_BUF, "SNI=%s %s",
                 sni_hostname, sni_tls_version);
        ulogd_log(ULOGD_DEBUG, "PRINTSNI: extracted SNI='%s'", sni_hostname);
    } else {
        /* Not a ClientHello or no SNI extension - still output TLS version if detected */
        if (sni_tls_version[0]) {
            snprintf(sni_print_buf, PRINTSNI_MAX_BUF, "TLS=%s (no SNI)", sni_tls_version);
        }
    }

    okey_set_ptr(&ret[SNI_OUT_SNI_HOSTNAME], sni_hostname);
    okey_set_ptr(&ret[SNI_OUT_TLS_VERSION], sni_tls_version);
    okey_set_ptr(&ret[SNI_OUT_PRINT], sni_print_buf);

    return ULOGD_IRET_OK;
}

static struct ulogd_plugin printsni_plugin = {
    .name = "PRINTSNI",
    .input = {
        .keys = sni_inp,
        .num_keys = ARRAY_SIZE(sni_inp),
        .type = ULOGD_DTYPE_RAW,
    },
    .output = {
        .keys = sni_outp,
        .num_keys = ARRAY_SIZE(sni_outp),
        .type = ULOGD_DTYPE_PACKET,
    },
    .interp = &printsni_interp,
    .version = "2.0.9",
};

void __attribute__ ((constructor)) init(void);

void init(void)
{
    ulogd_register_plugin(&printsni_plugin);
}
