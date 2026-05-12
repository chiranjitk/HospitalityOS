#!/bin/sh
###########################################################################
#       Script : Do entries in IPSET at the time of login
#       Last Updated : 30/07/2013
#
############################################################################

dbhostip=`cat /usr/local/cyberoam/properties/DistributedDB.properties | grep 'dbserverip' | cut -d = -f 2`

kernal=`uname -a | awk '{print $3}' | awk -F . '{print $1"."$2"."$3}'`
if [ $kernal = "2.6.18" ]; then
        newkernal=0
else
        newkernal=1
fi

################## FOR CACHING CONFIGURATION #######################

. /usr/local/nascomponents/properties/Caching.properties

####################################################################
. /etc/registration_customization_status.properties >> /dev/null  2>&1

usage_help()
{
    echo "Usage: $0   -i -P -s -a -o -t -c -C -v -V -d -u -D -U -h -f -F -p -g -m -M -n -N -q -Q -S -Z -X -J -j -K -k -B -I -W -G -r"
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
        echo "  -r Restrict URL Policy"
    exit 1
}

CYBEROAM=100;
PPPOE=101;
EAP=102;
RADIUS=103;
LEASEDLINE=104;
HTTPCLIENT=105;
CYBERCAFECLIENT=106;
clienttype=100;

policyid=0 ;
pool="nopool";

#Bandwidth parameters
resttype=0;
ipaddress=0.0.0.0;
totalclassid=0;
totalbandwidth=0;
downclassid=0;
upclassid=0;
downbandwidth=0;
upbandwidth=0;
filterid=0;
upfilterid=0;
downfilterid=0;
parentclassid=0;
upparentclassid=0;
dnparentclassid=0;
parentbandwidth=0;

guaranteedtotal=0;
guaranteedupload=0;
guaranteeddownload=0;
bindtomac=0;
macaddress=0;
mapwithlive=0;

xuserid=0;

cachingburstabledn=0;
cachingburstableup=0;
cachingguaranteeddn=0;
cachingguaranteedup=0;
iscacheqosuser=1;  #### By Default must be 1,If the value does not come this variable should not RESET ####

zcstatus=-1 # flag stating either zero configuration module is enabled or ipaddress of user not in any pool
network=-1  # To store value of netid/netmask given in -N option
userid=-1   # To store value of userid given in -M option ( login-once )
vlantag=""  # To store value of vlantag given in -V option ( login-once )
ipaddress_range=0;

gatewayid=-1

while getopts i:m:P:s:L:a:o:t:c:C:v:V:d:u:D:U:h:f:F:p:l:A:b:e:g:m:M:n:N:q:Q:S:Z:X:J:j:K:k:B:I:W:w:G:r: opt
do
        case "$opt" in
                i) ipaddress="$OPTARG";;
                P) pool="$OPTARG";;
                s) snat="$OPTARG";;
                L) mapwithlive="$OPTARG";;
                a) action="$OPTARG";;
                o) policyid="$OPTARG";;
                t) resttype="$OPTARG";;
                c) totalclassid="$OPTARG";;
                C) clienttype="$OPTARG";;
                v) totalbandwidth="$OPTARG";;
                d) downclassid="$OPTARG";;
                u) upclassid="$OPTARG";;
                D) downbandwidth="$OPTARG";;
                U) upbandwidth="$OPTARG";;
                h) filterid="$OPTARG";;
                f) upfilterid="$OPTARG";;
                F) downfilterid="$OPTARG";;
                p) parentclassid="$OPTARG";;
                b) upparentclassid="$OPTARG";;
                e) dnparentclassid="$OPTARG";;
                l) parentclassid="$OPTARG";;
                g) guaranteedtotal="$OPTARG";;
                m) guaranteedupload="$OPTARG";;
                M) userid="$OPTARG";;                  # user-id to for login-once -- used MAC in process so M
                V) vlantag="$OPTARG";;
                n) guaranteeddownload="$OPTARG";;
                N) network="$OPTARG";;                 # network user to be logged in
                q) bindtomac="$OPTARG";;
                Q) macaddress="$OPTARG";;
                S) ipsetname="$OPTARG";;
                Z) zcstatus="$OPTARG";;
                X) xuserid="$OPTARG";;
                J) cachingburstabledn="$OPTARG";;
                j) cachingguaranteeddn="$OPTARG";;
                K) cachingburstableup="$OPTARG";;
                k) cachingguaranteedup="$OPTARG";;
                B) iscacheqosuser="$OPTARG";;
                I) ipaddress_range="$OPTARG";;
                W) priority="$OPTARG";;
                w) qospriority="$OPTARG";;
                G) gatewayid="$OPTARG";;
                r) restricturlpolicy="$OPTARG";;
                \?) usage_help;;
        esac
done

#echo "---> $ipaddress_range"
LOCK=`cat /usr/local/cyberoam/properties/flock`


if [ $LOCK -eq 1 ] ; then

ME="loginscript.sh";
LCK="/tmp/${ME}.LCK";
exec 8>$LCK;

flock -x 8;

fi
if [ $# -lt 1 ]; then
    usage_help
fi

################ Edited by : Jogin Joshi. Nov 26, 2007 for login once ###############

if [ $network != -1 ] ; then  #Because login-once cant be for network and vice versa. note : cant use -ne
        ipaddress=$network # now all chains should for netid/netmask
fi

zcuser=-1
if [ "$ipsetname" = "NONE" -a "$zcstatus" = 1 ];then
        zcuser=1        # means user being processed is a zero configuration user
fi

#####################################################################################

#if [ $bindtomac -eq 1 ];then
#
#       /sbin/iptables -I accountingup -s $ipaddress -d 0/0 -j "$pool"up -t mangle --match mac --mac-source $macaddress
#        /sbin/iptables -I accountingdn -s 0/0 -d $ipaddress -j "$pool"dn -t mangle
#else
#
#       /sbin/iptables -I accountingup -s $ipaddress -d 0/0 -j "$pool"up -t mangle
#       /sbin/iptables -I accountingdn -s 0/0 -d $ipaddress -j "$pool"dn -t mangle
#
#fi


## DHCP Auto Login start
if [ -f /etc/dhcp/dhcpautologin ] ; then
        if [ $macaddress = 0 ];then
                macaddress=`sh /usr/local/scripts/getmacbyipfordhcp.sh $ipaddress`
                macaddress=`echo $macaddress | awk -F " " '{print $1}'`
        fi
        cat /etc/dhcp/dhcpautologin | while read line
        do
                if [ -f /etc/dhcpd_$line.conf ]
                then

                        grep -w "$ipaddress" /etc/dhcpd_$line.conf
                        if [ $? -eq 0 ]
                        then
                                ipmac=`grep -w $ipaddress /etc/dhcp/dhcpdipmac`
                                tmpipmac=`echo  "$ipaddress,$macaddress"`
                                if [[ "$ipmac" != "$tmpipmac" ]]; then
                                      echo "$ipaddress,$macaddress" >> /etc/dhcp/dhcpdipmac
                                fi
                        fi
                fi
        done
fi
## DHCP Auto Login end


/usr/local/scripts/bwscripts/applybandwidth.sh  -t $resttype  -i $ipaddress  -c $totalclassid -v $totalbandwidth -d $downclassid  -u $upclassid -D $downbandwidth -U $upbandwidth -h $filterid -f $upfilterid -F $downfilterid -p $parentclassid -l $parentclassid -b $upparentclassid -e $dnparentclassid -g $guaranteedtotal -m $guaranteedupload -n $guaranteeddownload -Z $zcuser -X $xuserid -J $cachingburstabledn  -j $cachingguaranteeddn -K $cachingburstableup -k $cachingguaranteedup -I $ipaddress_range -W $priority

bandwidthret=`echo $?`

if [ $bandwidthret -eq 0 ]; then

        if [ ! -z "$gatewayid" ] && [ $gatewayid -ne -1 ]; then
                ipset add gw${gatewayid}ipset $ipaddress
        fi

###### Chains for filter

if [ $policyid -gt 0 ]
then
        /sbin/iptables -I INPUT -s $ipaddress -d 0/0 -j $policyid -t filter     # security policy chain
        /sbin/iptables -A FORWARD -s $ipaddress -d 0/0 -j $policyid -t filter   # security policy chain
fi

###### Cache Qos SET entry
. /usr/local/nascomponents/properties/Caching.properties

if [ -z "$default_cache_bw" ] ;then
        default_cache_bw="no"
fi
if [ $caching = "yes" ] &&  [ $default_cache_bw = "no" ] ;then
        if [ $iscacheqosuser -eq 0 ];then
                ipset add normaluserset $ipaddress
        fi
fi

###### Chains for nat
## START URL FILTERING
if [ ! -z "$restricturlpolicy" ]; then
#/sbin/iptables -t nat -A PREROUTING -s $ipaddress -p tcp --dport 80 -j REDIRECT --to-port 3130
#/sbin/iptables -t nat -A PREROUTING -s $ipaddress -p tcp --dport 443 -j REDIRECT --to-port 3131

CHROOT_PATH="/home/users/centos7-root"
IPV4LIST_FILE="${CHROOT_PATH}/${restricturlpolicy}.list"
UFDB_CONFIG_FILE="${CHROOT_PATH}/etc/sysconfig/ufdbGuard.conf"

/usr/sbin/ipset -L urlfilternet_${restricturlpolicy} > /dev/null 2>&1
if [ $? -ne 0 ]; then
        /usr/sbin/ipset create urlfilternet_${restricturlpolicy} hash:net
fi

if [ $network != -1 ] ; then
        /usr/sbin/ipset add urlfilternet $ipaddress
        /usr/sbin/ipset add urlfilternet_${restricturlpolicy} $ipaddress
else
        /usr/sbin/ipset add urlfilternet ${ipaddress}/32
        /usr/sbin/ipset add urlfilternet_${restricturlpolicy} ${ipaddress}/32
fi

kill -28 `pidof ufdbguardd`
fi
## END URL FILTERING

kernalversion=`uname.org -a | awk '{print $3}' | awk -F . '{print $1"."$2"."$3}'`
new_kernel="N"
if [[ $kernalversion =~ "3.14" ]] ; then
        new_kernel="Y"
fi

if [ $action = "accept" ]
then
        if [ $ipaddress_range = "NONE" ]; then
                if [ $new_kernel = "Y" -a $multiplegateways = "Y" ];then
                        /sbin/iptables -A POSTROUTING -s $ipaddress -d 0/0 -j NFMOD -t nat
                else
                        /sbin/iptables -A POSTROUTING -s $ipaddress -d 0/0 -j ACCEPT -t nat
                fi
        else
                if [ $new_kernel = "Y" -a $multiplegateways = "Y" ];then
                        /sbin/iptables -A POSTROUTING -m iprange --src-range $ipaddress-$ipaddress_range -d 0/0 -j NFMOD -t nat
                else
                        /sbin/iptables -A POSTROUTING -m iprange --src-range $ipaddress-$ipaddress_range -d 0/0 -j ACCEPT -t nat
                fi
        fi
elif [ $action = "snat" ]
then

        #### We require this set in normal case also without caching and p2p condition
        ipset add loggedinuserssnatip $snat

        if [ $ipaddress_range = "NONE" ]; then
                /sbin/iptables -A POSTROUTING -s $ipaddress -d 0/0 -j SNAT --to-source $snat -t nat
        else
                /sbin/iptables -A POSTROUTING -m iprange --src-range $ipaddress-$ipaddress_range -d 0/0 -j SNAT --to-source $snat -t nat
        fi
        if [ $mapwithlive -eq 1 ]
        then
                        /sbin/iptables -A PREROUTING -s 0/0 -d $snat -j DNAT --to-destination $ipaddress -t nat
        fi
elif [ $action = "masq" ]
then
        if [ $ipaddress_range = "NONE" ]; then
                /sbin/iptables -A POSTROUTING -s $ipaddress -d 0/0 -j MASQUERADE -t nat
        else
                /sbin/iptables -A POSTROUTING -m iprange --src-range $ipaddress-$ipaddress_range -d 0/0 -j MASQUERADE -t nat
        fi
fi

##### Chains in INPUT for idle timeout support ######
#### Chains based on clienttype.
if [ $clienttype -eq 100 -o $clienttype -eq 106 ]; then
        /sbin/iptables -I intranetuploadaccounting -s $ipaddress -m multiport -p udp --dport 6060 -j ACCEPT
elif [ $clienttype -eq 105 ]; then
#### live req will be sent on port 9090
        /sbin/iptables -I intranetuploadaccounting -s $ipaddress -m multiport -p tcp --dport 9090 -j ACCEPT
fi
##### upto here #####
#ipset -A $ipsetname $ipaddress,0,0,0,"1:$filterid","1:$filterid",NONE,0,0
pool=`echo $pool | cut -d"p" -f2`
dnmark=`expr $pool + 1000`
if [ $totalclassid != "0" ];then
        upclass=$totalclassid
        dnclass=$totalclassid
else
        upclass=$upclassid
        dnclass=$downclassid
fi

################ Edited by : Jogin Joshi. Nov 26, 2007 ###############

#ON=0

#sh /usr/local/scripts/iscustomizationvisible.sh AGGREGATOR > /dev/null 2>&1
#aggrcust=$?

#sh /usr/local/scripts/iscustomizationvisible.sh IPSETIPMACBINDING > /dev/null 2>&1
#ipsetipmaccust=$?

if [ $ipaddress_range = "NONE" ]; then


        #ORG if [ $bindtomac -eq 1 -a $aggrcust -ne $ON -a $ipsetipmaccust -eq $ON -a "$macaddress" != "0" ];then
        if [ $bindtomac -eq 1 -a $AGGREGATOR != "Y" -a $IPSETIPMACBINDING = "Y" -a "$macaddress" != "0" ];then
                if [ $network != -1 ] ; then
                        ipset add loggedinusers $ipaddress
                        ipset add loggedinusersnetwork $ipaddress
                else
                        ipset add $ipsetname $ipaddress,$macaddress
                        ipset add loggedinusersdstip $ipaddress
                fi
        else
                ipset add loggedinusers $ipaddress
                if [ $network != -1 ] ; then
                        ipset add loggedinusersnetwork $ipaddress
                fi
        fi
else
        ipset add loggedinusers_leased $ipaddress
        #ipset -N leasedline$xuserid hash:ip
        ipset add usersset leasedline$xuserid
        ipset add usersdstset leasedline$xuserid
        ipset add llusersset leasedline$xuserid
        ipset add  leasedline$xuserid $ipaddress-$ipaddress_range
fi

fi

################ Edited by : Jogin Joshi. Nov 26, 2007 for login once###############

if [ $userid -ne -1 ]; then   # means login_once facility is needed for the user
ps -C dhcpd > /dev/null 2>&1

if [ $? -eq 0 ]; then
        if [ $macaddress = 0 ];then
                macaddress=`sh /usr/local/scripts/getmacbyipfordhcp.sh $ipaddress`
                macaddress=`echo $macaddress | awk -F " " '{print $1}'`
        fi

        if [ ! -z "$macaddress" ];then

                # If customizaton is not on and chain is not already inserted then only insert iptables chain #
                #ORG [ $aggrcust -ne $ON -a $bindtomac -ne 1 -a $ipsetipmaccust -ne $ON -a "$macaddress" != "0" ] && /sbin/iptables -I acctup -s $ipaddress -d 0/0 --match mac ! --mac-source $macaddress -j DROP -t mangle
                [ $AGGREGATOR != "Y" -a $bindtomac -ne 1 -a $IPSETIPMACBINDING != "Y" -a "$macaddress" != "0" ] && /sbin/iptables -I acctup -s $ipaddress -d 0/0 --match mac ! --mac-source $macaddress -j DROP -t mangle

                interface=`grep -wl $ipaddress /etc/dhcp/dhcpd.conf`
                ##if [ ! -z "$iface" ];then
        ##              interface=`grep -w DEVICE.*${iface} /etc/sysconfig/network-scripts/ifcfg-eth* | awk -F '=' '{print $2}'`
                ##fi

                #if [ ! -z "$interface" ];then
                #       sh /etc/dhcp/generateleasedipsfile.sh $interface LEASE $ipaddress $macaddress
                ##elif [ ! -z "$vlantag" ];then
                ##      sh /etc/dhcp/generateleasedipsfile.sh $vlantag LEASE $ipaddress $macaddress
                #else
                #       echo "Error"
                #fi

                ############ if the ipaddress is present in dhcpd.conf file then only omshell needs to be called######
                if [ ! -z "$interface" ]; then
                        hostname=`echo $macaddress | sed s/://g`
                        hostname=`echo $hostname | tr '[:lower:]' '[:upper:]'`

                        #ls -1 /etc/sysconfig/network-scripts/ifcfg-WLAN* /etc/sysconfig/network-scripts/ifcfg-eth* /etc/sysconfig/network-scripts/ifcfg-ra* 2> /dev/null | egrep 'ifcfg-.*[0-9]|ifcfg-.*[0-9]:[0-9]' | while read line
                        cat /etc/dhcpinterface | while read line
                        do
                        #. $line > /dev/null 2>&1

                        if [ -f /etc/dhcpd_$line.conf ]
                        then

                                grep -w "$ipaddress" /etc/dhcpd_$line.conf
                                if [ $? -eq 0 ]
                                then
                                        macaddress=`echo $macaddress | tr '[A-Z]' '[a-z]'`
                    grep -wi "$ipaddress,$macaddress" /etc/dhcp/login_once$line
                                        if [ $? -ne 0 ]
                                        then
                        echo "$ipaddress,$macaddress" >> /etc/dhcp/login_once$line
                        echo "$line,$ipaddress,$macaddress" >> /usr/local/nas/pipes/login_once_pipe
                                        fi
                                fi
                        fi
                        done


                fi

                ### If Relogin LeaseLine user is not running then only restart dhcp
                #if [ ! -e /var/run/rllu.pid -a ! -z "$interface" ];then
                        #sh /etc/rc.d/init.d/dhcpd stop $interface 2>&1 > /dev/null
                        #sh /etc/rc.d/init.d/dhcpd start $interface 2>&1 > /dev/null
                        #sh /etc/dhcp/omshell_script_staticlease.sh $macaddress $macaddress $ipaddress
                #fi
        fi
fi
fi
######################################################################


exit $bandwidthret

