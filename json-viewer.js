// import lit from CDN
import { html, css, LitElement } from 'https://cdn.skypack.dev/lit';
import { JsonElement } from './json-element.js';


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
			expandAll: { type: Boolean },
			elementCount: { type: Number },
		};
	}


	constructor() {
		super();
		this.json = {};
		this.expandAll = false;

	}


	render() {
		return html`
		<details open>
			<summary>${this.elementCount - 1} Elements</summary>
			<json-element .value=${this.json} .expanded=${true}></json-element>
		</details>
		`;
	}


}

customElements.define('json-viewer', JsonViewer);