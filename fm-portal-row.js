import { LitElement, html, css } from 'https://cdn.skypack.dev/lit-element';
import { FmRecordController } from './FileMaker.js';

export class FmPortalRow extends LitElement {
	createRenderRoot() {
		return this;
	}

	static get properties() {
		return {
			headers: { type: Array }, // received from parent
			recordData: { type: Object }, // received from parent
			controllerOptions: { type: Object }, // received from parent, passed to controller
			isUpdated: { type: Boolean, state: true }, // set to true when a field is updated
			valuesArray: { type: Array, state: true }, // calculated from recordData and headers
		}
	}


	willUpdate(changedProperties) {
		// set the recordId and modId when recordData changes
		if (changedProperties.has('recordData')) {
			this.recordId = this.recordData.recordId;
			this.modId = this.recordData.modId;
		}
		// create/update the recordController when controllerOptions change
		if (changedProperties.has('controllerOptions')) {
			if (!this.recordController) {
				this.recordController = new FmRecordController(this, this.controllerOptions);
			} else {
				this.recordController.options = this.controllerOptions;
			}
		}
		// update the valuesArray when recordData or headers change
		if (changedProperties.has('recordData') || changedProperties.has('headers') ||
			changedProperties.has('modId')) {
			if (this.recordData && this.headers) {
				this.valuesArray = this.getValuesArray(this.recordData, this.headers);
			}
		}
	}

	constructor() {
		super();
		this.recordData = {};
		this.updatedFields = {};
		this.index = -1;
		this.isUpdated = false;
	}

	render() {
		if (!this.recordController) {
			this.recordController = new FmRecordController(this, this.controllerOptions);
		}

		return html`
			<tr tabindex=0>
				${this.headers.map((header, cellIndex) => this.renderCell(header, this.recordData, cellIndex))}
			</tr>`
	}

	// render methods
	renderCell(header, data, cellIndex) {

		const options = {
			path: header.getAttribute('json-path'),
			field: header.getAttribute('field-name'),
			scriptName: header.getAttribute('script-name'),
			label: header.getAttribute('label'),

			isEditable: header.hasAttribute('is-editable'),
			isSaveButton: header.hasAttribute('save-button'),
			isDeleteButton: header.hasAttribute('delete-button'),
			headerText: header.textContent,
			cellIndex: cellIndex,
		}

		if (options.isSaveButton) {
			return this.renderSaveCell(options);
		} else if (options.isDeleteButton){
			return this.renderDeleteCell(options);
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
				@click=${this.saveRecord}
				tabindex=0>
					${options.label}
				</button>
			</td>
		`
	}

	renderDeleteCell(options) {
		return html`
			<td data-column=${options.headerText}>
				<button class='delete-row' @click=${this.deleteRecord} tabindex=0>
					${options.label}
				</button>
			</td>
		`
	}

	renderEditableCell(options) {
		const index = options.cellIndex;
		return html`
			<td field-name=${options.field} data-column=${options.headerText}>
				<input .value=${this.valuesArray[index]} @change=${this.inputChanged}>
			</td>
		`
	}

	renderClickCell(options) {
		return html`
			<td field-name=${options.field} 
			script-name=${options.scriptName} 
			@click=${this.clickHandler}
			data-column=${options.headerText}
			tabindex=0>
				${options.label}
			</td>
		`
	}

	renderFieldCell(options) {
		const index = options.cellIndex;
		return html`
			<td field-name=${options.field} data-column=${options.headerText}>
				${this.valuesArray[index]}
			</td>
		`
	}

	renderTextCell(options) {
		const index = options.cellIndex;
		return html`
			<td data-column=${options.headerText}>
				${this.valuesArray[index]}
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
			webviewer: this.controllerOptions.webviewerName,
		}
		this.recordController.performScript({
			script: scriptName,
			params,
			webviewerName: this.controllerOptions.webviewerName
		});
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

	saveRecord(e) {
		// save the record
		try {
			this.recordController.updateRecord({ fieldData: this.updatedFields });
			// go to next object in tab order
			const row = e.target.closest('tr');
			// get the first input element
			const next = row.querySelector('input');
			if (next) {
				next.focus();
			}
		} catch (error) {
			console.error('Error saving record', error);
		}
	}

	deleteRecord(e){
		try {
			this.recordController.deleteRecord();
		} catch (error) {
			console.error('Error deleting record', error);
		}
	}

	// helper functions
	getValuesArray(data, headers) {
		return headers.map(header => {
			const path = header.getAttribute('json-path');
			const field = header.getAttribute('field-name');
			const evalString = `data.${path}` + (field ? `?.['${field}']` : '');
			return eval(evalString) || null;
		})
	}
}


customElements.define('fm-portal-row', FmPortalRow);