#!/bin/sh

dbhostip=`cat /usr/local/cyberoam/properties/DistributedDB.properties | grep 'dbserverip' | cut -d = -f 2`
. /etc/registration_customization_status.properties > /dev/null  2>&1

loginIPv4=/usr/local/scripts/loginscript_ipv4.sh
loginIPv6=/usr/local/scripts/loginscript_ipv6.sh

LOGFILE=/var/log/loginscript.log

function usage_help()
{
        echo "Usage: $0 -i -P -s -a -o -t -c -C -v -V -d -u -D -U -h -f -F -p -g -m -M -n -N -q -Q -S -Z -X -J -j -K -k -B -I -W -G -r"
        echo "Options: These are optional argument"
        echo "       -i ipaddress "
        echo "       -P pool"
        echo "       -s snat ipaddress"
        echo "       -L Map with Live (1 for yes)"
        echo "       -a action"
        echo "       -o security policyid"
        echo
        echo "Bandwidth Restriction Parameters "
        echo "      -t restriction type"
        echo "      -i source ipaddress"
        echo "      -c totalclassid"
        echo "      -C clienttype"
        echo "      -v totalbandwidth"
        echo "      -d download classid"
        echo "      -u upload classid"
        echo "      -D download bandwidth "
        echo "      -U upload bandwidth"
        echo "      -h totalfilterid / fw handle"
        echo "      -f upload filterid"
        echo "      -F download filterid"
        echo "      -p parent classidf / parent classid"
        echo "      -b up parent classid"
        echo "      -e dn parent classid"
        echo "      -l parent bandwidth"
        echo "      -g guaranteedtotal"
        echo "      -m guaranteedupload"
        echo "      -M userid of user needs login-once " # Userid that needs login-once facility -- Jogin
        echo "      -V vlantag of user needs login-once "
        echo "      -n guaranteeddownload"
        echo "      -N netid/netmask"          # when user is a network not a stand-alone computer. -- Jogin
        echo "      -q bindtomac"
        echo "      -Q macaddress"
        echo "      -S IPSet Name"
        echo "      -Z Zero configuration flag"
        echo "      -X User ID "
        echo "      -J burstable Caching Download"
        echo "      -j guaranteed Caching Download"
        echo "      -K burstable Caching upload"
        echo "      -k guaranteed Caching Upload"
        echo "  -B Cache Qos user" ## user having cache bandwidth cache QoS
        echo "  -I Ipaddress with range for leased line"
        echo "  -W Priority"
        echo "  -w Cache QOS Priority"
        echo "  -G GatewayID"
        echo "  -r Restricted URL policy"
        exit 1
}

function splitvalues()
{
        IFS='#' read -a myarray <<< "$4"
        eval ${2}4=${myarray[0]}
        eval ${2}6=${myarray[1]}

        if [ $3 -eq 1 ]; then
                if [ -z "${myarray[1]}" ]; then
                        eval ${2}6=${myarray[0]}
                fi
        fi

        #if [ ${#myarray[@]} -gt 2 ]; then
        #       echo "Invalid Args"
        #fi

        temp4=
        temp6=
        eval temp4='$'${2}4
        eval temp6='$'${2}6

        IPv4String=" $IPv4String -${1} ${temp4}"
        IPv6String=" $IPv6String -${1} ${temp6}"
}

function parse_args()
{

        IPv4String=
        IPv6String=

        while getopts i:m:P:s:L:a:o:t:c:C:v:V:d:u:D:U:h:f:F:p:l:A:b:e:g:m:M:n:N:q:Q:S:Z:X:J:j:K:k:B:I:W:w:G:r: opt
        do

                case "$opt" in
                        i) splitvalues i ipaddress 0 "$OPTARG";;
                        P) splitvalues P pool 0 "$OPTARG";;
                        s) splitvalues s snat 0 "$OPTARG";;
                        L) splitvalues L mapwithlive 0 "$OPTARG";;
                        a) splitvalues a action 0 "$OPTARG";;
                        o) splitvalues o policyid 0 "$OPTARG";;
                        t) splitvalues t resttype 0 "$OPTARG";;
                        c) splitvalues c totalclassid 0 "$OPTARG";;
                        C) splitvalues C clienttype 0 "$OPTARG";;
                        v) splitvalues v totalbandwidth 0 "$OPTARG";;
                        d) splitvalues d downclassid 0 "$OPTARG";;
                        u) splitvalues u upclassid 0 "$OPTARG";;
                        D) splitvalues D downbandwidth 0 "$OPTARG";;
                        U) splitvalues U upbandwidth 0 "$OPTARG";;
                        h) splitvalues h filterid 0 "$OPTARG";;
                        f) splitvalues f upfilterid 0 "$OPTARG";;
                        F) splitvalues F downfilterid 0 "$OPTARG";;
                        p) splitvalues p parentclassid 0 "$OPTARG";;
                        b) splitvalues b upparentclassid 0 "$OPTARG";;
                        e) splitvalues e dnparentclassid 0 "$OPTARG";;
                        l) splitvalues l parentclassid 0 "$OPTARG";;
                        g) splitvalues g guaranteedtotal 0 "$OPTARG";;
                        m) splitvalues m guaranteedupload 0 "$OPTARG";;
                        M) splitvalues M userid 0 "$OPTARG";;                  # user-id to for login-once -- used MAC in process so M
                        V) splitvalues V vlantag 0 "$OPTARG";;
                        n) splitvalues n guaranteeddownload 0 "$OPTARG";;
                        N) splitvalues N network 0 "$OPTARG";;                 # network user to be logged in
                        q) splitvalues q bindtomac 0 "$OPTARG";;
                        Q) splitvalues Q macaddress 0 "$OPTARG";;
                        S) splitvalues S ipsetname 0 "$OPTARG";;
                        Z) splitvalues Z zcstatus 0 "$OPTARG";;
                        X) splitvalues X xuserid 0 "$OPTARG";;
                        J) splitvalues J cachingburstabledn 0 "$OPTARG";;
                        j) splitvalues j cachingguaranteeddn 0 "$OPTARG";;
                        K) splitvalues K cachingburstableup 0 "$OPTARG";;
                        k) splitvalues k cachingguaranteedup 0 "$OPTARG";;
                        B) splitvalues B iscacheqosuser 0 "$OPTARG";;
                        I) splitvalues I ipaddress_range 0 "$OPTARG";;
                        W) splitvalues W priority 0 "$OPTARG";;
                        w) splitvalues w qospriority 0 "$OPTARG";;
                        G) splitvalues G gatewayid 0 "$OPTARG";;
                        r) splitvalues r restricturlpolicy 0 "$OPTARG";;
                        \?) usage_help;;
                esac
        done
}
parse_args $*

sh $loginIPv4 $IPv4String
retval4=$?

echo "`date` : Exit value of command [ sh $loginIPv4 $IPv4String ] is $retval4" >> $LOGFILE

if [ "$ipv6" = "y" -o "$ipv6" = "Y" ]; then
        if [ ! -z "$ipaddress6" ]; then
                sh $loginIPv6 $IPv6String
                retval6=$?
                echo "`date` : Exit value of command [ sh $loginIPv6 $IPv6String ] is $retval6" >> $LOGFILE
        else
                echo "`date` : IPv6address is missing, do not call $loginIPv6" >> $LOGFILE
        fi
else
        echo "`date` : Ipv6 Module is disabled, do not call $loginIPv6" >> $LOGFILE
fi


exit $retval4
