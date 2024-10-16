import { LitElement, html, css } from 'https://cdn.skypack.dev/lit-element';

export class JsonData extends LitElement {

	static get styles() {
		return css`
			:host {
				display: none;
			}
			`
	}

	static get properties() {
		return {
			data: { type: Object },
			key: { type: String },
		}
	}

	willUpdate(changedProperties) {
		if (changedProperties.has('data')) {
			const { key, data } = this;
			const parent = this.parentElement;
			// add the data to the parent element
			parent[key] = data;
		}
	}

	render() {
		return html`
			<slot @slotchange=${this.saveSlottedText}></slot>
			`
	}

	saveSlottedText() {
		try {
			const slot = this.shadowRoot.querySelector('slot');
			const textNode = slot.assignedNodes()[0];
			// save object of url variables
			const urlParams = new URLSearchParams(window.location.search);
			// loop through entries in urlParams
			const urlVars = {};
			for (const [key, value] of urlParams) {
				urlVars[key] = value;
			}
			// get the text content of the slot,
			// this will be a template literal
			// example = `Hello ${urlVars.name}`
			const text = textNode.textContent;
			// evaluate the template literal
			const json = eval('`' + text + '`');

			this.data = json;
		} catch (error) {
			console.error('Error parsing JSON', error);
			throw error;
		}
	}
}

window.customElements.define('json-data', JsonData);