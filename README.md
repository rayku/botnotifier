botnotifier
===========
This piece is a Jabber client at its core.
Then we have newBot object on top of it that can act as either GTALK or FBCHAT client.
So this app should be launched in two instances - one for GTALK and one for FBCHAT.


step.1

edit facebook.js and gtalk.js files to configure the connection parameters for both chat services

step.2

Run: node gtalk.js
the service is running after you see "Service running at http://..." 

Run: node facebook.js
the service is running after you see "Service running at http://..." 

Now you can.........

Send Message:
http://serviceHost:servicePort/msg/USER_ID/MSG
Important:  MSG is urlencoded string,please use urlencode function of php
example: http://localhost:8892/msg/longbill@live.cn/hello%20world
if message sent successfully it will return 'ok'

Get User status:
http://serviceHost:servicePort/status/MSNaccount
example: http://localhost:8892/status/longbill@live.cn
it will return the user's status code,only 'online','away' and 'offline'

Add a contact (this works for gtalk but does not work for FB):
http://serviceHost:servicePort/add/USER_ID

Get online list:
http://serviceHost:servicePort/onlines