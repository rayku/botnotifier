var starttls = require('./starttls');
var sasl = require('./sasl');
var JID = require('./jid').JID;
var SRV = require('./srv');
var net = require('net');
var sys = require('sys');
var EventEmitter = require('events').EventEmitter;
exports.bot = xmppBot;


function xmppBot(params)
{
	EventEmitter.call(this);
	this.jid = new JID(params.jid);
	this.password = params.password;
	var self = this;
	this.cl = new net.Socket();
	this.cl.setNoDelay(true);

	function errorFunction()
	{
		somethingdontexists();
	}
	
	if (params.host)
	{
		this.cl.connect(params.port || 5222, params.host);
		this.cl.on('connect',function()
		{
			self.onConnect();
        });
    }
	else
	{
        var attempt = SRV.connect(this.cl,['_xmpp-client._tcp'], this.jid.domain, 5222);
        attempt.addListener('connect', function()
		{
            self.onConnect();
        });
    }

	this.cl.on('end',errorFunction);
	this.cl.on('close',errorFunction);
	this.cl.on('error',errorFunction);

}
sys.inherits(xmppBot, EventEmitter);

xmppBot.prototype.onConnect = function()
{
	var self = this;
	SEND(self.cl,'<stream:stream xmlns:stream="http://etherx.jabber.org/streams" xmlns="jabber:client" version="1.0" to="'+self.jid.domain+'">',/starttls/,function(s)
	{
		SEND(self.cl,'<starttls xmlns="urn:ietf:params:xml:ns:xmpp-tls"/>',/\>/,function(s)
		{
			self.cl = starttls(self.cl,undefined, function()
			{
				SEND(self.cl,'<stream:stream xmlns:stream="http://etherx.jabber.org/streams" xmlns="jabber:client" version="1.0" to="'+self.jid.domain+'">',/mechanisms/,function(s)
				{
					if (self.jid.domain.match(/facebook/i))
						self.authFB(s);
					else
						self.auth(s);
				});
			});
		});	
	});
};

xmppBot.prototype.auth = function(s)
{
	this.mech = sasl.selectMechanism(s);
	this.mech.authzid = this.jid.bare().toString();
    this.mech.authcid = this.jid.user;
    this.mech.password = this.password;
    this.mech.realm = this.jid.domain;
    this.mech.digest_uri = "xmpp/" + this.jid.domain;
    var authMsg = encode64(this.mech.auth());
	var self = this;
	SEND(this.cl,'<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="'+this.mech.name+'">'+authMsg+'</auth>',/\>/,function(s)
	{
		if (s.indexOf('success') != -1)
		{
			SEND(self.cl,'<stream:stream xmlns:stream="http://etherx.jabber.org/streams" xmlns="jabber:client" version="1.0" to="'+self.jid.domain+'">',/session/,function(s)
			{
				SEND(self.cl,'<iq type="set" id="bind"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"/></iq>',/<\/iq>/,function(s)
				{
					SEND(self.cl,'<iq type="set" to="'+self.jid.domain+'" id="sess"><session xmlns="urn:ietf:params:xml:ns:xmpp-session"/></iq>',/iq/,function(s)
					{
						self.online();
					});
				});
			});
		}
		else
		{
			console.log('auth failed');
		}
	})
}

xmppBot.prototype.authFB = function(s)
{
	this.mech = sasl.selectMechanism(s);
	this.mech.authzid = this.jid.bare().toString();
	this.mech.authcid = this.jid.user;
	this.mech.password = this.password;
	this.mech.realm = this.jid.domain;
	this.mech.digest_uri = "xmpp/" + this.jid.domain;
	var authMsg = encode64(this.mech.auth());
	var self = this;
	SEND(this.cl,'<auth xmlns="urn:ietf:params:xml:ns:xmpp-sasl" mechanism="'+this.mech.name+'">'+authMsg+'</auth>',/<\/challenge>/,function(s)
	{
		var text = decode64(s.match(/>([^<]+)</)[1]);
   		var re = encode64(self.mech.challenge(text));
		SEND(self.cl,'<response xmlns="urn:ietf:params:xml:ns:xmpp-sasl">'+re+'</response>',/>/,function(s)
		{
			if (s.indexOf('failure') != -1)
			{
				console.log('authorize failed');
				return;
			}
			SEND(self.cl,'<response xmlns="urn:ietf:params:xml:ns:xmpp-sasl"/>',/>/,function(s)
			{
				if (s.indexOf('success') != -1)
				{
					SEND(self.cl,'<stream:stream xmlns="jabber:client" xmlns:stream="http://etherx.jabber.org/streams" to="'+self.jid.domain+'" version="1.0">',/>/,function(s)
					{
						SEND(self.cl,'<iq type="set" id="bind"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"/></iq>',/<\/iq>/,function(s)
						{
							SEND(self.cl,'<iq type="set" to="'+self.jid.domain+'" id="sess"><session xmlns="urn:ietf:params:xml:ns:xmpp-session"/></iq>',/iq/,function(s)
							{
								self.online();
							});
						});
					});
				}
				else
				{
					console.log('Authorize failed!');
				}
			});
		});
	});
}
xmppBot.prototype.online = function()
{
	var self = this;
	var expectings = {};
	console.log('yes! online!');
	this.cl.on('data',function(data)
	{
		var s = data.toString();
		console.log('GOT: '+s);
		
		for(var cmd in expectings)
		{
			if (s.match(expectings[cmd].reg))
			{
				expectings[cmd].callback(s);
				delete(expectings[cmd]);
			}
		}
		
		var ms = s.match(/^\s*<(\w+)\s/);
		if (ms && ms[1] && self['_'+ms[1]])
		{
			self['_'+ms[1]].call(self,s);
			return;
		}
		
	});
	
	SEND(this.cl,'<presence><show>chat</show><status>online</status></presence>');
	process.stdin.resume();
	process.stdin.setEncoding('utf8');
	process.stdin.on('data', function (chunk)
	{
		var cmd = chunk.toString().split(' ',3);
		if (cmd[0] == 'm')
		{
			self.send(cmd[1],cmd[2]);
		}
	});
	this.emit('connect');
	
	
	function sendAndExpect(cmd,reg,callback)
	{
		if (callback) expectings[cmd] = {reg:reg,callback:callback};
		self.cl.write(cmd);
	}
	
}

xmppBot.prototype.send = function(to,msg)
{
	SEND(this.cl,'<message type="chat" to="'+to+'"><active xmlns="http://jabber.org/protocol/chatstates"/><body>'+msg+'</body><arc:record otr="false" xmlns:arc="http://jabber.org/protocol/archive"/></message>');
}

xmppBot.prototype.addContact = function(jid,name)
{
	if (!name) name = jid;
	SEND(this.cl,'<iq type="set"><query xmlns="jabber:iq:roster"><item jid="'+jid+'" name="'+name+'"></item></query></iq>');
	SEND(this.cl,'<presence to="'+jid+'" type="subscribe"/>');
}

xmppBot.prototype._presence = function(s)
{
	var from = s.match(/from\=\"([^\"]+)\"/)[1];
	if (s.match(/type=[\'\"]subscribe/i))
	{
		SEND(this.cl,'<presence to="'+from+'" type="subscribed"/>');
		return;
	}
	if (s.match(/unavailable/))
	{
		var show = 'offline';
	}
	else
	{
		var show = s.match(/<show>([^<]+)<\/show>/);
		show = (show && show[1]) ? show[1] : 'online';
	}
	if (show == 'dnd') show = 'away';
	if (show == 'xa') show = 'away';
	console.log('Presence: '+from+' '+show);
	this.emit("presence",from,show);
	if (from.match(/facebook\.com/i))
	{
		SEND(this.cl,'<iq type="get" to="'+from+'"><vCard xmlns="vcard-temp"/></iq>');
	}
}

xmppBot.prototype._challenge = function(s)
{
	var text = decode64(s.match(/>([^<]+)</)[1]);
    var re = encode64(this.mech.challenge(text));
	SEND(this.cl,'<response xmlns="urn:ietf:params:xml:ns:xmpp-sasl">'+re+'</response>',/>/,function(s)
	{
		if (s.indexOf('success') == -1)
		{
			console.log('challenge failed!');
		}
	})
}

function SEND(socket,s,reg,callback)
{
	// if (socket.writable)
	// {
		console.log('\r\nCLIENT: \r\n'+s);
		socket.write(s);
		if (callback)
		{
			var buf = '';
			var _onData;
			socket.on('data',_onData = function(data)
			{
				buf += data.toString();
				if (buf.match(reg))
				{
					console.log('\r\nXMPP: \r\n'+buf);
					socket.removeListener('data',_onData);
					callback(buf);
				}
			});
		}
//	}
}

function decode64(encoded) {
    return (new Buffer(encoded, 'base64')).toString('utf8');
}
function encode64(decoded) {
    return (new Buffer(decoded, 'utf8')).toString('base64');
}
