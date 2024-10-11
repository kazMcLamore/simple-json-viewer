// import lit from CDN
import { html, css, LitElement } from 'https://cdn.skypack.dev/lit';
import { JsonElement } from './json-element.js';
import { ContextProvider } from 'https://cdn.skypack.dev/@lit-labs/context';
import { jsonContext } from './constants.js';


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
		this._provider = new ContextProvider(this, {
			context: jsonContext,
			initialValue: {
				elementCount: 0,
			}
		});
	}

	render() {
		return html`
			<div>${this.subElementCount}</div>
			<json-element .value=${this.json} .expanded=${true}></json-element>
		`;
	}

}

customElements.define('json-viewer', JsonViewer);