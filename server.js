const express = require('express');
const { Gauge, register } = require('prom-client')
const axios = require('axios');

const HOST = '0.0.0.0';
const PORT = '8081';
app = express();

const counter = new Gauge({
	name: 'wrk2_api_latency_per_minute',
	help: 'Jaeger post API latency(ms) per minute'
});

app.get('/metrics', async (req, res) => {
	let url = process.env.JAEGER_URL || "http://172.26.128.130:31111";
	// let url = "http://172.26.128.130:31111";
	let end = Date.now() * 1000;
	let start = end - ( 60 * 1000000 );
	let operation = "/wrk2-api/post/compose";
	let service = "nginx-web-server";
	try {
		const result = await axios.get(`${url}/api/traces?end=${end}&lookback=custom&operation=${operation}&service=${service}&start=${start}`)
		
		let data = result.data.data;
		let avg_duration = 0;
		data.forEach(api => {
			let duration = api.spans.find(span => span.references.length == 0).duration || 0;
			avg_duration += duration / 1000;
			//counter.inc({ id: api.traceID }, duration);
		});
		avg_duration = (avg_duration / data.length) || 0;
		counter.set(avg_duration);

	}
	catch(error) {
		console.log("Jaeger-Tracing Error: " + error);
	}
	finally{
		res.set('Content-Type', register.contentType);
		res.end(await register.getSingleMetricAsString('wrk2_api_latency_per_minute'));
	};
	//res.set('Content-Type', register.contentType);
	//res.end(await register.getSingleMetricAsString('wrk2_api_latency_per_minute'));
});

app.listen(PORT, HOST, ()=> {
	console.log(`Jaeger Tracing: Server listening at http://${HOST}:${PORT}`);
});
