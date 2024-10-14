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
		}


			json-element {
				--string-color: green;
				--number-color: red;
				--boolean-color: blue;
				--null-color: gray;
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
				color: #777;
				border: 0.5px solid #777;
				border-radius: 3px;
				padding: 0 .5rem;
			}
			span {
				display: inline-block;
				margin: 0;
			}
		`;
	}


	static get properties() {
		return {
			json: { type: Object },
			elementCount: { type: Number, state: true },
			layoutName: { type: String, reflect: true, attribute: 'layout-name' },
			queryScript: { type: String, reflect: true, attribute: 'query-script' },
			query: { type: Object, state: true },
			webviewerName: { type: String, reflect: true, attribute: 'webviewer-name' },
			limit: { type: Number, reflect: true },
		};
	}


	constructor() {
		super();
		this.json = {};
		this.expandAll = false;
		this.elementCount = 0;
		this.query = {};

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
		// return html`
		// <details open>
		// 	<summary>${this.elementCount - 1} Elements</summary>
		// 	<json-element .value=${this.json} .expanded=${true}></json-element>
		// </details>
		// `;

		return html`
			<details open>
			${this.queryTask.render({
				initial: () => html`Loading...`,
				pending: () => html`Querying...`,
				complete: () => html`
					<summary>${this.elementCount - 1} Elements</summary>
					<json-element .value=${this.json} .expanded=${true}></json-element>
				`,
				error: () => html`Error loading the component`,
			})}
			</details>
		`
	}

	queryTask = new Task(this, {
		task: async ([viewer, scriptName, query], { signal }) => {
			const result = await WebViewer.performScript({
				script: scriptName,
				params: query,
				webviewerName: viewer,
				scriptOption: WebViewer.scriptOptions.SUSPEND,
				performOnServer: false
			})
			console.log('query result', result);
			return result.data;
		},
		args: () => [this.webviewerName, this.layoutName, this.query],
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