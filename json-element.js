// import lit from CDN
import { html, css, LitElement, nothing } from 'https://cdn.skypack.dev/lit';

import { styleMap } from 'https://cdn.skypack.dev/lit/directives/style-map.js';
import { cache } from 'https://cdn.skypack.dev/lit/directives/cache.js';

export class JsonElement extends LitElement {

	createRenderRoot() {
		return this;
	}

	static bracketColorsArray = [
		'orange',
		'green',
		'red',
		'blue',
		'purple',
	]

	static get properties() {
		return {
			type: { type: String },
			value: { type: Object }, // can be string, number, boolean, object, array, or null
			expanded: { type: Boolean, reflect: true },
			level: { type: Number }, // nesting level
			key: { type: String, reflect: true }, // key of the object
			addComma: { type: Boolean },
			subElementCount: { type: Number, state: true },
		}
	}


	determineType(value) { 
		if (Array.isArray(value)) {
			return 'array';
		} else if (value === null) {
			return 'null';
		} else if (typeof value === 'object') {
			return 'object';
		} else {
			return typeof value;
		}
	}

	willUpdate(changedProperties) {

		if (changedProperties.has('value')) {

			// remove the old type class
			const oldType = this.determineType(changedProperties.get('value'))
			this.type = this.determineType(this.value);

			// add the new type class
			this.classList.add(this.type);

			// remove the old type class
			if (this.classList.contains(oldType)) {
				this.classList.remove(oldType);
			}
			
			// update the subElementCount
			if (this.type == 'array') {
				this.subElementCount = this.value.length;
			} else if (this.type == 'object') {
				this.subElementCount = Object.keys(this.value).length;
			} else {
				this.subElementCount = 0;
			}
			
		}
	}

	constructor() {
		super();
		this.type = 'string';
		this.value = '';
		this.expanded = false;
		this.key = '';
		this.level = 0;
		this.addComma = false;
		this.subElementCount = 0;

	}


	render() {
		const bracketColor = JsonElement.bracketColorsArray[this.level % JsonElement.bracketColorsArray.length] || 'black';

		return html`
			${this.key ? this.keyTemplate() : nothing}
			${this.type === 'array' ? html`<span class='leading-char' style="color:${bracketColor}" @click=${this.toggleExpand}>[</span>` : nothing}
			${this.type === 'object' ? html`<span class='leading-char' style="color:${bracketColor}" @click=${this.toggleExpand}>{</span>` : nothing}
			${this.valueTemplate()}
			${this.type === 'array' ? html`<span class='trailing-char' style="color:${bracketColor}" @click=${this.toggleExpand}>]</span>` : nothing}
			${this.type === 'object' ? html`<span class='trailing-char' style="color:${bracketColor}" @click=${this.toggleExpand}>}</span>` : nothing}
			${this.addComma ? html`<span>,</span>` : nothing}
		`
	}

	keyTemplate() {
		return html`
			<span class="key" @click=${this.toggleExpand}>"${this.key}":</span>
		`
	}

	valueTemplate() {

		const collapsed = !this.expanded && (this.type === 'object' || this.type === 'array');
		const collapsedTemplate = html`
			<span class="collapsed"
			@click=${this.toggleExpand}>
			${this.subElementCount} ${this.type === 'object' ? 'attribute' : 'element'}${this.subElementCount > 1 ? 's' : ''}</span>`;

		let template = nothing;

		switch (this.type) {
			case 'object':
			case 'array':

				// create an element for each key in the object
				template = html`
				${Object.keys(this.value).map((key, index) => {
					return html`
							<json-element
								key=${this.type != 'array' ? key : ''} 
								.value=${this.value[key]} 
								.level=${this.level + 1}
								.addComma=${index < Object.keys(this.value).length - 1}>
								</json-element>
						`
				})}
				`
				break;
			case 'string':
				template = html`
					<span class="value">"${this.value}"</span>
				`
				break;
			case 'number':
			case 'boolean':
				template = html`
					<span class="value">${this.value}</span>
				`
				break
			case 'null':
				template = html`
					<span class="value">null</span>
				`
				break
		}

		// cache the template to prevent re-rendering of the children
		// this way, if a child is expanded before the parent collapse,
		// when the parent is expanded again the child will be in the same state
		return html`
			${cache(collapsed ? collapsedTemplate : template)}
			`

	}

	toggleExpand(e) {
		// get altKey from the event
		const altKey = e.altKey;
		this.expanded = !this.expanded;
		if (this.expanded && altKey) {
			this.expandAll();
		} else if (!this.expanded && altKey) { 
			this.collapseAll();
		}


	}

	expandAll() {
		this.expanded = true;
		// select json-elements AFTER LitElement update is complete
		// otherwise, the elements will not be found
		this.updateComplete.then(() => {
			const elements = this.querySelectorAll('json-element.object, json-element.array');
			elements.forEach((element) => {
				element.expanded = true;
				element.expandAll();
			});
		});
	}

	collapseAll() {
		this.expanded = false;
		const elements = this.querySelectorAll('json-element.object, json-element.array');
		elements.forEach((element) => {
			element.expanded = false;
			element.collapseAll();
		});
	}
}

customElements.define('json-element', JsonElement);