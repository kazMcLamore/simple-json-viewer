import { LitElement, html, css } from 'https://cdn.skypack.dev/lit-element';
import { FmRecordController } from './FileMaker.js';

export class FmPortalRow extends LitElement {
	createRenderRoot() {
		return this;
	}

	static get properties() {
		return {
			headers: { type: Array }, // received from parent
			fields: { type: Object }, // set from recordData

			recordId: { type: Number, reflect: true }, // for controller
			modId: { type: Number }, // for controller
			isUpdated: { type: Boolean, reflect: true },

			controllerOptions: { type: Object }, // received from parent, passed to controller
		}
	}

	// set by parent OR by controller after making api request
	set recordData(value) {
		if (value === this._recordData) return
		if (!value) return
		if (value == {}) return

		this._recordData = value;
		this.recordId = value.recordId;
		this.modId = value.modId;
		this.requestUpdate();
	}

	get recordData() {
		return this._recordData;
	}

	constructor() {
		super();
		this.recordData = {};
		this.updatedFields = {};
		this.index = -1;
	}

	render() {
		if (!this.recordController) {
			this.recordController = new FmRecordController(this, this.controllerOptions);
		}

		return html`
			<tr>
				${this.headers.map(header => this.renderCell(header, this.recordData))}
			</tr>`
	}

	// render methods
	renderCell(header, data) {
		const path = header.getAttribute('json-path');
		const field = header.getAttribute('field-name');
		const evalString = `data.${path}` + (field ? `['${field}']` : '')

		const options = {
			path: path,
			field: field,
			scriptName: header.getAttribute('script-name'),
			isEditable: header.hasAttribute('is-editable'),
			isSaveButton: header.hasAttribute('save-button'),
			label: header.getAttribute('label'),
			value: eval(evalString),
			headerText: header.textContent,
		}
		// console.log(options, evalString, data)



		if (options.isSaveButton) {
			return this.renderSaveCell(options);
		} else if (options.isEditable && options.field.length) {
			return this.renderEditableCell(options);
		} else if (options.scriptName) {
			return this.renderClickCell(options);
		} else if (options.field) {
			return this.renderFieldCell(options);
		} else {
			return this.renderTextCell(options);
		}
	}

	renderSaveCell(options) {
		return html`
			<td field-name=${options.field} data-column=${options.headerText}>
				<button class='save-row' 
				?disabled=${!this.isUpdated} 
				@click=${this.saveRecord}>
					${options.label}
				</button>
			</td>
		`
	}

	renderEditableCell(options) {
		return html`
			<td field-name=${options.field} data-column=${options.headerText}>
				<input .value=${options.value} @change=${this.inputChanged}>
			</td>
		`
	}

	renderClickCell(options) {
		return html`
			<td field-name=${options.field} 
			script-name=${options.scriptName} 
			@click=${this.clickHandler}
			data-column=${options.headerText}>
				${options.label}
			</td>
		`
	}

	renderFieldCell(options) {
		return html`
			<td field-name=${options.field} data-column=${options.headerText}>
				${options.value}
			</td>
		`
	}

	renderTextCell(options) {
		return html`
			<td data-column=${options.headerText}>
				${options.value}
			</td>
		`
	}

	// event handlers
	clickHandler(e) {
		// perform the script
		const scriptName = e.target.getAttribute('script-name');
		const params = {
			data: this.recordData,
			index: this.index,
			webviewer: this.webviewerName,
		}
		this.recordController.performScript({ script: scriptName, params, webviewerName: this.webviewerName });
	}

	inputChanged(e) {
		const td = e.target.closest('td');
		const field = td.getAttribute('field-name');
		const value = e.target.value;
		this.updatedFields[field] = value;
		this.isUpdated = true;

		// this.requestUpdate();

		// dispatch custom event
		const event = new CustomEvent('field-changed', {
			detail: {
				field: field,
				value: value,
				recordId: this.recordId,
				modId: this.modId,
				index: this.index,
			}
		});

		this.dispatchEvent(event);
	}

	saveRecord() {
		// save the record
		try {
			this.recordController.updateRecord({ fieldData: this.updatedFields });
			this.isUpdated = false;
		} catch (error) {
			console.error('Error saving record', error);
		}
	}
}


customElements.define('fm-portal-row', FmPortalRow);