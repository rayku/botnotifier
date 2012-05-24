step.1

edit msn.js to configure the bot account and api service port

step.2

Run: node start.js
the service is running after you see "Service running at http://..." 

step.3

use your browser or file_get_contents function of php to URLs bellow,

Send Message:
http://serviceHost:servicePort/msg/MSNaccount/MSG
Important:  MSG is urlencoded string,please use urlencode function of php
example: http://localhost:8892/msg/longbill@live.cn/hello%20world
if message sent successfully it will return 'ok'
if MSNaccount is not online or not in the bot's contact list it will return 'offline'

Get User status:
http://serviceHost:servicePort/status/MSNaccount
example: http://localhost:8892/status/longbill@live.cn
it will return the user's status code,only 'online','away' and 'offline'

Add a contact:
http://serviceHost:servicePort/add/MSNaccount

Get online list:
http://serviceHost:servicePort/onlines