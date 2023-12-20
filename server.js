const express = require('express');
const { Gauge, register } = require('prom-client')
const axios = require('axios');

const HOST = '0.0.0.0';
const PORT = '8081';
app = express();

const avg_counter = new Gauge({
	name: 'wrk2_avg_api_latency',
	help: 'Jaeger average post API latency (ms)'
});

const max_counter = new Gauge({
	name: 'wrk2_max_api_latency',
	help: 'Jaeger max post API latency (ms)'
});

app.get('/metrics', async (req, res) => {
	let scrape_window = (process.env.SCRAPE_WINDOW || 60) * 1000 * 1000 // microseconds
	let url = process.env.JAEGER_URL || "http://172.26.128.130:31111";
	let end = Date.now() * 1000; // microseconds
	let start = end - ( scrape_window );
	let operation = "/wrk2-api/post/compose";
	let service = "nginx-web-server";
	try {
		const result = await axios.get(`${url}/api/traces?end=${end}&lookback=custom&operation=${operation}&service=${service}&start=${start}`)
		
		let data = result.data.data;
		let avg_duration = 0;
		let max_duration = 0;
		data.forEach(api => {
			let duration = (api.spans.find(span => span.references.length == 0).duration) / 1000 || 0; // milliseconds
			avg_duration += duration;
			max_duration = Math.max(max_duration, duration);
		});
		avg_duration = (avg_duration / data.length) || 0;
		avg_counter.set(avg_duration);
		max_counter.set(max_duration);

	}
	catch(error) {
		console.log("Jaeger-Tracing Error: " + error);
	}
	finally {
		res.set('Content-Type', register.contentType);
		res.end(await register.metrics());
	}
});

app.listen(PORT, HOST, ()=> {
	console.log(`Jaeger Tracing: Server listening at http://${HOST}:${PORT}`);
});
