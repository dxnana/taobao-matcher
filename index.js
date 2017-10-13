const express = require('express')
const bodyParser = require('body-parser')
const match = require('./match.js')

let app = express()

let server = app.use(bodyParser.urlencoded({    
  extended: true
})).all('/', (req, res, next) => {
	let file = '', img = ''
	if (req.body.file && req.body.img) {
		file = req.body.file
		img = req.body.img
	}
	let head = `
		<form action="#" method="POST">
			<p>本地页面文件</p>
			<input type="input" name="file" size="150" value="${file}">
			<p>淘宝图片链接</p>
			<textarea name="img" rows="8" cols="150">${img}</textarea>
			<p><input type="submit" /></p>
		</form>
	`
	if (file && img) {
		match(file, img).then(data => {
			res.send(`
				${head}
				<p>输出</p>
				<p>${data.err.map((i) => `[${i.type}] ${i.msg}`).join('<br>')}</p>
				<textarea name="img" rows="18" cols="150">${data.html}</textarea>
				${data.html}
			`)
			next()
		})
	} else {
		res.send(head)
		next()
	}
}).listen(3000, () => {
	console.log('Listening at http://%s:%s', server.address().address, server.address().port)
})
