// import lit from CDN
import { html, css, LitElement, nothing } from 'https://cdn.skypack.dev/lit';
import { styleMap } from 'https://cdn.skypack.dev/lit/directives/style-map.js';
import { cache } from 'https://cdn.skypack.dev/lit/directives/cache.js';

export class JsonElement extends LitElement {

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
			addComma: { type: Boolean }
		}
	}

	static get styles() {
		return css`
			:host{
				display: block;
				--string-color: green;
				--number-color: red;
				--boolean-color: blue;
				--null-color: gray;
				font-family: monospace;
			}
			.collapsed {
				cursor: pointer;
			}
			.collapsed:hover {
				text-decoration: underline;
			}
			json-element {
				display: block;
				margin-left: 20px;
			}
			.leading-char {
				cursor: pointer;
			}
			.trailing-char {
				cursor: pointer;
			}
			.key {
				cursor: pointer;
			}
			.colon {
				color: #777;
			}
			:host(.string) .value {
				color: var(--string-color);
			}
			:host(.number) .value {
				color: var(--number-color);
			}
			:host(.boolean) .value {
				color: var(--boolean-color);
			}
			:host(.null) .value {
				color: var(--null-color);
			}
		`;
	}

	set value(value) {
		const oldType = this.type;
		this._value = value;

		// update type from value, 
		// distinguish between array, object, and null
		if (Array.isArray(value)) {
			this.type = 'array';
		} else if (value === null) {
			this.type = 'null';
		} else if (typeof value === 'object') {
			this.type = 'object';
		} else {
			this.type = typeof value;
		}

		// remove previous class
		if (oldType) {
			this.classList.remove(oldType);
		}

		// add new class
		this.classList.add(this.type);
		this.requestUpdate();
	}

	get value() {
		return this._value;
	}

	constructor() {
		super();
		this.type = 'string';
		this.value = '';
		this.expanded = false;
		this.key = '';
		this.level = 0;
	}

	render() {
		const bracketColor = JsonElement.bracketColorsArray[this.level % JsonElement.bracketColorsArray.length] || 'black';

		return html`
			${this.key ? this.keyTemplate() : nothing}
			${this.type === 'array' ? html`<span class='leading-char' style="color:${bracketColor}" @click=${this.toggleExpand}>[</span>` : ""}
			${this.type === 'object' ? html`<span class='leading-char' style="color:${bracketColor}" @click=${this.toggleExpand}>{</span>` : ""}
			${this.valueTemplate()}
			${this.type === 'array' ? html`<span class='trailing-char' style="color:${bracketColor}" @click=${this.toggleExpand}>]</span>` : ""}
			${this.type === 'object' ? html`<span class='trailing-char' style="color:${bracketColor}" @click=${this.toggleExpand}>}</span>` : ""}
			${this.addComma ? html`<span>,</span>` : nothing}
		`
	}

	keyTemplate() {
		return html`
			<span class="key" @click=${this.toggleExpand}>"${this.key}" :</span>
		`
	}

	valueTemplate() {

		const collapsed = !this.expanded && (this.type === 'object' || this.type === 'array');
		const collapsedTemplate = html`
			<span class="collapsed" @click=${this.toggleExpand}>...</span>
		`;

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

	toggleExpand() {
		this.expanded = !this.expanded;
	}
}

customElements.define('json-element', JsonElement);