const fs = require('fs')
const path = require('path')
const getPixels = require('get-pixels')
const Entities = new (require('html-entities').XmlEntities)
const replaceAll = require('replace-string')

module.exports = (localFile, imagesHtml) => new Promise((resolve, reject) => {
	let localHtml = fs.readFileSync(localFile).toString()
	let errArr = []
	
	let imageTagPatten = /<img .*?src="(.+?)".*?>/g
	let matches
	let remoteImageUrls = []
	let remoteImages = {}
	while ((matches = imageTagPatten.exec(imagesHtml)) != null) {
		remoteImageUrls.push(matches[1])
	}
	
	let pathMap = {}
	let pendingCount = remoteImageUrls.length
	if (!pendingCount) {
		error(`There are no img tags in link list`)
		resolve({ err: errArr, html: '' })
	}
	
	remoteImageUrls.forEach(url => {
		getPixels(url, (err, pixels) => {
			if (err) {
				error(`Cannot load URL ${url}: ${err}`)
			} else {
				let key = pixels.shape.join(',')
				if (!remoteImages[key]) {
					remoteImages[key] = []
				}
				remoteImages[key].push({ url, data: Array.from(pixels.data) })
			}
			
			pendingCount--
			if (!pendingCount) {
				doCompare()
			}
		})
	})
	
	function doCompare() {
		let imageTagPatten = /<img .*?src="(.+?)".*?>/g
		let matches
		let localImageFiles = []
		while ((matches = imageTagPatten.exec(localHtml)) != null) {
			let absPath = path.resolve(localFile, '..', Entities.decode(matches[1]))
			localImageFiles.push(absPath)
			pathMap[absPath] = matches[1]
		}
		
		localImageFiles = Array.from(new Set(localImageFiles))
		let pendingCount = localImageFiles.length
		if (!pendingCount) {
			error(`There are no img tags in the local file`)
			resolve({ err: errArr, html: '' })
		}
		
		localImageFiles.forEach(file => {
			getPixels(file, (err, pixels) => {
				if (err) {
					error(`Cannot load file ${file}: ${err}`)
				} else {
					let key = pixels.shape.join(',')
					if (!remoteImages[key]) {
						error(`Cannot match file ${file} to any of remote ones (no images with same dimensions)`)
					} else if (remoteImages[key].length == 1) {
						replaceFile(file, remoteImages[key][0].url)
					} else {
						replaceFile(file, pixelMatch(file, Array.from(pixels.data), remoteImages[key]).url)
					}
				}
				
				pendingCount--
				if (!pendingCount) {
					let html = postProcess()
					resolve({ err: errArr, html })
				}
			})
		})
	}
	
	function pixelMatch(localFile, pixelData, remoteImages) {
		let fitness = remoteImages.map(matchData =>
			1 - matchData.data.reduce((old, data, i) => old + Math.abs(data - ~~pixelData[i]), 0) / 255 / matchData.data.length
		)
		let fitIndex = fitness.reduce((old, fit, i) => (fit > fitness[old] ? i : old), 0)
		if (fitness[fitIndex] < 0.99) {
			warn(`File ${localFile} matched to ${remoteImages[fitIndex].url} with less confidence (${fitness[fitIndex]})`)
		}
		return remoteImages[fitIndex]
	}
	
	function postProcess() {
		replace('<a href=', '<a target="_blank" href=')
		replace(' alt=""', '')
		let dimension = /<table .*?width="(.+?)".*?height="(.+?)".*?>/.exec(localHtml)
		let w = 1920, h = 1000
		if (!dimension) {
			error('No dimension of the page was found')
		} else {
			w = dimension[1]
			h = dimension[2]
		}
		let html = `
			<div style="width:${w}px;height:${h}px;">
		    	<div class="footer-more-trigger" style="left:50%;top:auto;border:none;padding:0;">
		    		<div class="footer-more-trigger" style="left:-${~~(w/2)}px;top:auto;border:none;padding:0;">
		    			<table width="${w}" height="${h}" border="0" cellpadding="0" cellspacing="0" style="font-size:0;line-height:0;">
							${localHtml.replace(/(^[\s\S]*<table .+?>)|(<\/table>[\s\S]*$)/gm, '')}
	        			</table>
	        		</div>
	        	</div>
	        </div>
		`
		return html.replace(/\s+/g, ' ').replace(/> </g, '>\n<');
	}
	
	function replace(from, to) {
		localHtml = replaceAll(localHtml, from, to)
	}
	
	function replaceFile(localFile, remoteUrl) {
		localHtml = replaceAll(localHtml, pathMap[localFile], remoteUrl)
	}
	
	function error(msg) {
		errArr.push({ type: 'error', msg })
		console.error(msg)
	}
	
	function warn(msg) {
		errArr.push({ type: 'warn', msg })
		console.warn(msg)
	}
})
