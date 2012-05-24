var http = require('http');
var EventEmitter = require('events').EventEmitter;
var sys = require('sys');

exports.webapi = function(port,host)
{
	EventEmitter.call(this);
	var self = this;
	http.createServer(function (req, res)
	{
		res.writeHead(200, {'Content-Type': 'text/plain'});
		var _p = req.url.split('/');
		var action = _p[1];
		var argvs = [action,res];
		for(var i=2;i<_p.length;i++)
		{
			argvs.push(decodeURIComponent(_p[i]));
		}
		if (action)
		{
			self.emit.apply(self,argvs);
		}
		else
		{
			res.end('error request!');
		}
	}).listen(port,host);
	console.log('---Service running at http://'+host+':'+port);
}

sys.inherits(exports.webapi, EventEmitter);
