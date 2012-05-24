var account = 'php.js.cn@hotmail.com';
var password = 'wojiuswo';
var displayName = 'Chunlong';
var servicePort = 8894;


var webapi = require('./lib/webapi').webapi;
var api = new webapi(servicePort);
var accountName;

var net = require('net');
var https = require('https');

var global_socket,trID;
var sendMSG = function(){ };
var onlines = {};
var sbTrID = 0;
var botStatus = 'offline';
var reTried = 1;

contactMS(connectNS);


process.on('uncaughtException', function (err)
{
	console.log(err);
	process.exit(3);
});

function relogin()
{
	process.exit(3);
	// if (botStatus == 'waiting') return;
	// 	api.removeAllListeners('msg');
	// 	api.removeAllListeners('status');
	// 	api.removeAllListeners('onlines');
	// 	api.removeAllListeners('add');
	// 	
	// 	reTried = reTried * 2;
	// 	botStatus = 'waiting';
	// 	try
	// 	{
	// 		global_socket.destroy();
	// 		delete(global_socket);
	// 	}
	// 	catch(e){ }
	// 	setTimeout(function()
	// 	{
	// 		contactMS(connectNS);
	// 	},reTried*1000);
	// 	
	// 	console.log("Re login will begin in "+reTried+' seconds...');
}

function connectNS(host,port)
{
	trID = 0;
	console.log('Connect to '+host+':'+port);
	var cl = net.createConnection(port,host);
	global_socket = cl;
	cl.on('connect',function()
	{
		SEND('VER '+(++trID)+' MSNP8 CVR0',function(s)
		{
			SEND('CVR '+(++trID)+' 0x0409 win 4.10 i386 MSNMSGR 5.0.0544 MSMSGS '+account,function(s)
			{
				SEND('USR '+(++trID)+' TWN I '+account,function(s)
				{
					var p = s.split(' ',5);
					if (p[0] == 'USR')
					{
						var challenge = p[4];
						console.log('Getting Login URL...');
						getLoginURL(function(opts)
						{
							console.log('Login URL is: '+opts.host+opts.path);
							doSSLLogin(opts,challenge,function(formPP)
							{
								SEND('USR '+(++trID)+' TWN S '+formPP,function(s)
								{
									var arr = s.split('\r\n',2)[0].split(' ',7);
									if (arr[5] == 1)
									{
										accountName = arr[4];
										reTried = 1;
										afterOnline();
									}
									else
									{
										console.log('Authorize failed, after sent USR!');
									}
								});
							});
						});
					}
					else
					{
						console.log('Unknown command found: '+s);
					}
				});
			});
		});
	});
	
	cl.on('error',function()
	{
		console.log('on error');
		relogin();
	});
	cl.on('close',function()
	{
		console.log('on close');
		relogin();
	});
	cl.on('end',function()
	{
		console.log('on end');
		relogin();
	});
}


function afterOnline()
{
	botStatus = 'online';
	var expectings = {};
	var cl = global_socket;
	
	cl.on('data',function(data)
	{
		var s = data.toString('utf8');
		console.log(s);
		
		for(var key in expectings)
		{
			if (s.indexOf(key) === 0)
			{
				console.log('found expecting '+key);
				expectings[key](s);
				delete(expectings[key]);
				return;
			}
		}
		
		
		
		var lines = s.split('\r\n');
		for(var i =0,len=lines.length;i<len;i++)
		{
			var cmd = lines[i].match(/^([A-Z]{3})\s/);
			if (cmd && cmd[1])
			{
				cmd = cmd[1];
				//console.log("the cmd is "+cmd);
				if (cl['on'+cmd])
				{
					//console.log('executing on'+cmd+' ...');
					cl['on'+cmd](lines[i]);
					continue;
				}
				console.log('>>'+lines[i]);
			}
		}
		
	});
	
	SEND('SYN '+(++trID)+' 0');
	
	//set online
	SEND('CHG '+(++trID)+' NLN');
	SEND('REA '+(++trID)+' '+account+' '+displayName);
	SEND('BLP '+(++trID)+' AL');
	SEND('GTC '+(++trID)+' N');
	
	cl.onMSG = function(s)
	{
		
	};
	
	cl.onNOT = function(s)
	{
		
	};
	
	//server returns online list
	cl.onILN = function(s)
	{
		var p = s.split(' ',6);
		var status = p[2];
		var email = p[3];
		if (email) onlines[email.toLowerCase()] = transStatus(status);
	};
	
	//contact offline
	cl.onFLN = function(s)
	{
		var p = s.replace(/\r\n$/,'').split(' ');
		var email = p[1];
		if (email) delete(onlines[email.toLowerCase()]);
	};
	
	//contact online(also away)
	cl.onNLN = function(s)
	{
		var p = s.split(' ',4);
		var status = p[1];
		var email = p[2];
		if (email) onlines[email.toLowerCase()] = transStatus(status);
	};
	
	//challenge from server
	cl.onCHL = function(s)
	{
		//console.log('challenge from server...');
		var challenge = s.replace(/\r\n$/,'').split(' ',3)[2];
		//the following clientID and clientCode is from http://www.hypothetic.org/docs/msn/notification/pings_challenges.php
		var clientID = 'PROD0061VRRZH@4F';
		var clientCode = 'JXQ6J@TUOGYV@N0M';
		var response = 'QRY '+(++trID)+' '+clientID+' 32\r\n'+require('crypto').createHash('md5').update(challenge+clientCode).digest('hex');
		SEND(response);
	};
	
	
	
	function sendAndExpect(s,re,callback,socket)
	{
		if (!socket) socket = cl;
		expectings[re] = callback;
		console.log('Send: '+s+' and expecting: '+re);
		if (socket.writable) socket.write(s+'\r\n');
	}
	
	
	function sendMsg(to,msg)
	{
		console.log('getting sb server!');
		sendAndExpect('XFR '+(++trID)+' SB','XFR '+trID,function(s)
		{
			var sbTrID = 0;
			var p = s.split(' ',6);
			var sbHost = p[3].split(':')[0];
			var sbPort = p[3].split(':')[1];
			var token = p[5].replace(/\r\n$/,'');
			console.log('connecting to sb: '+sbHost+':'+sbPort+' token='+token);
			
			var sb = net.createConnection(sbPort,sbHost);
			//sb.setEncoding('utf8');
			//sb.setNoDelay(true);
			
			sb.on('connect',function()
			{
				sbSEND(sb,'USR '+(++sbTrID)+' '+account+' '+token,function(s)
				{
					if (s.indexOf('USR') == -1)
					{
						console.log('Error!');
						return;
					}
					
					var cmd = 'CAL '+(++sbTrID)+' '+to+'\r\n';
					console.log('sb<<<'+cmd);
					sb.write(cmd);
				
					sb.on('data',function(data)
					{
						var s = data.toString();
						console.log('want JOI>>>'+s);
						if (s.indexOf('JOI') != -1)
						{
							sb.removeAllListeners('data');
							msg = msg.replace(/\r\n$/,'');
							var s = 'MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'+msg;
							if (sb.writable)
							{
								sb.write('MSG '+(++sbTrID)+' A '+(new Buffer(s,'utf8')).length+'\r\n'+s);
								sb.once('data',function(data)
								{
									var _s = data.toString('utf8').replace(/\r\n$/,'');
									console.log('sb>>>'+_s);
									sbSEND(sb,'OUT');
									try
									{
										sb.destroy();
									}catch(e){ }
								});
							}
						}
					});
				
				});

			});
		});
	}

	
	api.on('msg',function(res,to,msg)
	{
		to = to.toLowerCase().replace(/^\s+|\s+$/g,'');
		msg = msg.replace(/^\s+|\s+$/g,'');
		if (!to || !msg)
		{
			res.end('input error');
			return;
		}
		if (!onlines[to] ||  onlines[to] == 'offline')
		{
			res.end('offline');
		}
		else
		{
			sendMsg(to,msg);
			res.end('ok');
		}
	});
	
	api.on('status',function(res,to)
	{
		to = to.toLowerCase().replace(/^\s+|\s+$/g,'');
		if (!to)
		{
			res.end('input error');
			return;
		}
		for(var j in onlines)
		{
			if (j.indexOf(to) === 0)
			{
				res.end(onlines[j]);
				return;
			}
		}
		res.end('offline');
	});
	
	api.on('onlines',function(res)
	{
		for(var j in onlines)
		{
			res.write(j+' '+onlines[j]+'\r\n');
		}
		res.end('over');
	});
	api.on('add',function(res,jid,name)
	{
		jid = jid.toLowerCase().replace(/^\s+|\s+$/g,'');
		if (!jid)
		{
			res.end('input error');
			return;
		}
		SEND('ADD 16 AL '+jid+' '+jid);
		SEND('ADD 17 FL '+jid+' '+jid+' 0');
		res.end('ok');
	});
	
}

function transStatus(s)
{
	var statuses = 
	{
		'AWY':'away',
		'NLN':'online', //online
		'FLN':'offline', //offline
		'BSY':'away', //busy
		'IDL':'away',
		'BRB':'away', //back soon
		'PHN':'away', //on phone
		'LUN':'away', //having lunch
		'HDN':'offline' //hidden
	};
	return statuses[s]?statuses[s]:'offline';
}


function getLoginURL(callback)
{
	https.get({host:'nexus.passport.com',path:'/rdr/pprdr.asp'},function(res)
	{
		if (res.headers.passporturls)
		{
			var url = res.headers.passporturls.match(/DALogin\=([^\,]+)/i);
			if (url && url[1])
			{
				var _p = url[1].split('/',2);
				callback({ host: _p[0], path:'/'+_p[1]});
			}
		}
	});
}

function doSSLLogin(opts,challenge,callback)
{
	opts.port = 443;
	opts.method = 'GET';
	opts.headers = 
	{
		'Authorization':'Passport1.4 OrgVerb=GET,OrgURL=http%3A%2F%2Fmessenger%2Emsn%2Ecom,sign-in='+encodeURIComponent(account)+',pwd='+encodeURIComponent(password)+','+challenge
	};
	console.log('Authorizing...');
	var req = https.request(opts,function(res)
	{
		if (res.statusCode == 401)
		{
			console.log('Authorize failed!');
		}
		else if (res.statusCode == 302)
		{
			if (res.headers.location)
			{
				var _p = res.headers.location.split('/',4);
				opts.host = _p[2];
				opts.path = '/'+_p[3];
				console.log('Redirected to '+opts.host+opts.path);
				var req = https.request(opts,function(res)
				{
					if (req.statusCode == 200)
					{
						console.log('OK!');
						var info = res.headers['authentication-info'];
						var ms = info.match(/from\-PP\=\'([^\']+)/);
						if (ms && ms[1])
						{
							callback(ms[1]);
						}
					}
					else
					{
						console.log('Error when try 2!');
						console.log(res);
					}
				});
				req.end();
			}
		}
		else if (res.statusCode == 200)
		{
			console.log('OK!');
			var info = res.headers['authentication-info'];
			var ms = info.match(/from\-PP\=\'([^\']+)/);
			if (ms && ms[1])
			{
				callback(ms[1]);
			}
		}
		else
		{
			console.log('Error status code when try 1!');
			console.log(res);
		}
	});
	req.on('error',function(err)
	{
		console.log(err);
	});
	req.end();
}

//contact the msn server to get the notification server
function contactMS(callback)
{
	if (botStatus != 'offline' && botStatus != 'waiting') return;
	botStatus = 'ing';
	trID = 0;
	console.log('Connect to messenger.hotmail.com:1863');
	var cl = net.createConnection(1863,'messenger.hotmail.com');
	global_socket = cl;
	cl.on('connect',function()
	{
		SEND('VER '+(++trID)+' MSNP8 CVR0',function(s)
		{
			SEND('CVR '+(++trID)+' 0x0409 win 4.10 i386 MSNMSGR 5.0.0544 MSMSGS '+account,function(s)
			{
				SEND('USR '+(++trID)+' TWN I '+account,function(s)
				{
					var p = s.split(' ');
					if (p[0] == 'XFR' && p[2] == 'NS')
					{
						var _p = p[3].split(':');
						var NSHost = _p[0];
						var NSPort = _p[1];
						callback(NSHost,NSPort);
					}
					else
					{
						console.log('Unknown command found: '+s);
					}
				});
			});
		});
	});
}


function sbSEND(sb,s,callback)
{
	s = s.replace(/\r\n$/,'');
	console.log("sb<<<"+s);
	if (sb.writable)
	{
		sb.once('data',function(data)
		{
			var _s = data.toString('utf8').replace(/\r\n$/,'');
			console.log('sb>>>'+_s);
			callback(_s);
		});
		return sb.write(s+'\r\n');
	}
	else
	{
		console.log('sb socket is not writable');
	}
}


function SEND(s,callback)
{
	s = s.replace(/\r\n$/,'');
	console.log("<"+s);
	if (callback)
	{
		global_socket.once('data',function(data)
		{
			var _s = data.toString('utf8').replace(/\r\n$/,'');
			console.log('>'+_s);
			callback(_s);
		});
	}
	return global_socket.write(s+'\r\n');
}