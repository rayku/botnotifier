var net = require('net');
var xmpp = require('./xmpp');
var webapi = require('./webapi');

exports.newBot = function(params)
{
	var onlines = {};
	var bot = new xmpp.bot(params);
	bot.on('presence',function(jid,status)
	{
		if (status != 'online')
		{
			try{ delete(onlines[jid]); } catch(e) { }
		}
		else
		{
			onlines[jid] = status;
		}
		console.log(onlines);
	});



	var api = new webapi.webapi(params.servicePort?params.servicePort:8892);
	api.on('msg',function(res,jid,msg)
	{
		bot.send(jid,escapeHtml(msg));
		res.end('ok');
	});
	api.on('status',function(res,jid)
	{
		for(var j in onlines)
		{
			if (j.indexOf(jid) === 0)
			{
				res.end(onlines[j]);
				return;
			}
		}
		res.end('offline');
	});
	api.on('onlines',function(res)
	{
                res.write(
                    JSON.stringify(
                        onlines
                    )
                );
                res.end();
	});
	api.on('add',function(res,jid,name)
	{
		bot.addContact(jid,name);
		res.end('ok');
	});
	
	
	function escapeHtml(unsafe) {
	    return unsafe
	        .replace("&", "&amp;")
	        .replace("<", "&lt;")
	        .replace(">", "&gt;")
	        .replace("\"", "&quot;")
	        .replace("'", "&#039;");
	}
}
// 
// 
// exports.newBot.on('uncaughtException',function(err)
// {
// 	try
// 	{
// 		delete(bot);
// 		webapi.server.destroy();
// 	}catch(e){ }
// });