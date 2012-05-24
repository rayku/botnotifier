var type = process.argv[2];
if (!{'gtalk':true,'facebook':true}[type])
{
	console.log('usage: \r\nnode start.js gtalk\r\nor:\r\nnode start.js facebook\r\n');
	process.exit(0);
}

function start()
{
	var ls = require('child_process').spawn('node', [type+'.js']);
	ls.stdout.on('data', function (data)
	{
		console.log(data.toString());
	});
	ls.stderr.on('data', function (data)
	{
		console.log(data.toString());
	});
	ls.on('exit', function (code)
	{
		console.log('child process exited with code ' + code);
		delete(ls);
		setTimeout(start,5000);
	});
}

start();