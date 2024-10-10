// import lit from CDN
import { html, css, LitElement } from 'https://cdn.skypack.dev/lit';
import { JsonElement } from './json-element.js';

export class JsonViewer extends LitElement {

	static get properties() {
		return {
			json: { type: Object },
			expandAll: { type: Boolean },
		};
	}

	constructor() {
		super();
		this.json = {};
		this.expandAll = false;
	}

	render() {
		return html`
			<json-element .value=${this.json} .expanded=${true}></json-element>
		`;
	}
}

customElements.define('json-viewer', JsonViewer);