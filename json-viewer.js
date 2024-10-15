// import lit from CDN
import { html, css, LitElement } from 'https://cdn.skypack.dev/lit';
import { JsonElement } from './json-element.js';
import { WebViewer } from './FileMaker.js';
import { Task } from 'https://cdn.skypack.dev/@lit/task';


export class JsonViewer extends LitElement {

	static get styles() {
		return css`
		:host{
			display: block;
			font-family: monospace;
			margin-bottom: 1rem;
			--string-color: green;
			--number-color: red;
			--boolean-color: blue;
			--null-color: gray;
			--collapsed-color: gray;
		}


			json-element {
				display: block;
				padding: .1rem 0;
				margin-left: 1rem;
			}
			.collapsed {
				cursor: pointer;
			}
			.collapsed:hover {
				text-decoration: underline;
			}

			json-element.object > .key, 
			json-element.array > .key,
			json-element.object > .leading-char,
			json-element.array > .leading-char,
			json-element.object > .trailing-char,
			json-element.array > .trailing-char {
				cursor: pointer;
			}

			.colon {
				color: #777;
			}
			json-element.string .value {
				color: var(--string-color);
			}
			json-element.number .value {
				color: var(--number-color);
			}
			json-element.boolean .value {
				color: var(--boolean-color);
			}
			json-element.null .value {
				color: var(--null-color);
			}
			span.collapsed {
				color: var(--collapsed-color, #777);
				border: 0.5px solid #777;
				border-radius: 3px;
				padding: 0 .5rem;
			}
			span {
				display: inline-block;
				margin: 0;
			}

			div.loading {
				margin: 1rem;
				padding: 1rem;
			}

			div.error {
				margin: 1rem;
				padding: 1rem;
				border: 1px solid #f00;
				border-radius: 5px;
				background-color: #f9f9f9;
				color: #f00;
			}
		`;
	}


	static get properties() {
		return {
			json: { type: Object },
			elementCount: { type: Number, state: true },
			scriptName: { type: String, reflect: true, attribute: 'query-script' },
			query: { type: Object, state: true },
			webviewerName: { type: String, reflect: true, attribute: 'webviewer-name' },
			title: { type: String, reflect: true },
			jsonPath: { type: String, reflect: true, attribute: 'json-path' },
			open: { type: Boolean, reflect: true },
			bracketColors: { type: Array },
		};
	}


	constructor() {
		super();
		this.json = {};
		this.expandAll = false;
		this.elementCount = 0;
		this.query = {};
		this.title = '';
		this.jsonPath = '';
		this.scriptName = 'sub: execute data api (fxp)';

	}

	willUpdate(changedProperties) {
		if (changedProperties.has('json')) { 

			// convert from string if needed
			if (typeof this.json === 'string') {
				this.json = JSON.parse(this.json);
			}

			// count all elements
			this.elementCount = this.countAllElements(this.json);
		}
	}


	render() {

		return html`
			<details ?open=${this.open}>
			<summary>${this.title ? this.title : ''}${this.elementCount - 1} Elements</summary>
			${this.queryTask.render({
				initial: () => html`<div class='loading'>loading the component ...</div>`,
				pending: () => html`<div class='loading'>getting data ...</div>`,
				complete: (data) => html`
					<json-element
						.value=${this.json} 
						.expanded=${true} 
						.bracketColors=${this.bracketColors}>
					</json-element>
				`,
				error: (err) => html`<div class='error'>Error loading the component: ${err.message}</div>`,
			})}
			</details>
		`
	}

	queryTask = new Task(this, {
		task: async ([viewer, scriptName, query, jsonPath], { signal }) => {
			const result = await WebViewer.performScript({
				script: scriptName,
				params: query,
				webviewerName: viewer,
				scriptOption: WebViewer.scriptOptions.SUSPEND,
				performOnServer: false
			})
			this.json = eval(`result.${jsonPath}`);
			return this.json;
		},
		args: () => [this.webviewerName, this.scriptName, this.query, this.jsonPath],
	});


	// helper functions
	countAllElements(json) { 
		let count = 0;
		function countElements(value) {
			if (Array.isArray(value)) {
				count += 1;
				value.forEach(v => countElements(v));
			} else if (value === null) {
				count += 1;
			} else if (typeof value === 'object') {
				count += 1;
				Object.values(value).forEach(v => countElements(v));
			} else {
				count += 1;
			}
		}
		countElements(json);
		return count;
	}

}

customElements.define('json-viewer', JsonViewer);