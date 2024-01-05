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
	let operation = "compose_post_server";
	let service = "compose-post-service";
	try {
		const result = await axios.get(`${url}/api/traces?end=${end}&lookback=custom&operation=${operation}&service=${service}&start=${start}`);
		//const result = await axios.get(`${url}/api/traces?end=${end}&lookback=custom&service=${service}&start=${start}`);
		
		let data = result.data.data;
		let avg_duration = 0;
		let max_duration = 0;
		//let durations = data.map(api => api.spans.find(span => span.references.length == 0).duration / 1000 || 0);
		let durations = data.map(api => {
			let duration_span = api.spans.find(span => span.operationName === "compose_post_server");
			let duration = duration_span.duration / 1000;
			return duration || 0;
		});
		//let durations = data.map(api => api.spans.find(span => span.operationName === "compose_post_server").duration / 1000 || 0);
		if(durations.length > 0) {
			avg_duration = durations.reduce( (a,b) => a+b ) / durations.length;
			max_durations = durations.sort((a,b) => b-a).slice(0, Math.max(durations.length * 0.05, 1)); // Top 5% of durations
			max_duration = max_durations.reduce( (a,b) => a+b ) / max_durations.length;
		}
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
