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
			console.log('adding to parent')
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
			const textNodes = slot.assignedNodes();
			const text = textNodes.map(node => node.textContent).join('');
			let textTrimmed = text.trim();
			// save object of url variables
			const urlParams = new URLSearchParams(window.location.search);
			// substitute url variables in the text
			for (const [key, value] of urlParams) {
				textTrimmed = textTrimmed.replace(`{{${key}}}`, value);
			}

			const json = JSON.parse(textTrimmed);
			this.data = json;
		} catch (error) {
			console.error('Error parsing JSON', error);
			throw error;
		}
	}
}

window.customElements.define('json-data', JsonData);