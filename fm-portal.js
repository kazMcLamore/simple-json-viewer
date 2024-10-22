import { LitElement, html, css, nothing, render } from 'https://cdn.skypack.dev/lit-element';
import { cache } from 'https://cdn.skypack.dev/lit/directives/cache.js';
import { repeat } from 'https://cdn.skypack.dev/lit/directives/repeat.js';
import { FmQueryController } from './FileMaker.js';
import { FmPortalRow } from './fm-portal-row.js';


export class FmPortal extends LitElement {

	static get styles() {
		return css`
			:host {
				position: relative;
				--background-color: #F5F5F5;
				--border-color: rgb(183, 183, 183);
			}
			div.loading {
				position: absolute;
				top: -27px;
				left: 55px;
				z-index: 100;
				padding: .2rem .5rem;
				border: 1px solid var(--border-color);
				border-radius: 5px;
				text-wrap: nowrap;
			}
			.error {
				color: red;
			}
			div#page-buttons {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: .2rem .5rem;
			}
			div#record-info {
				text-align: center;
				padding: .5rem 0 0 0;
				background-color: var(--background-color);
				width: 100%;
				position: sticky;
				bottom: 0;
				z-index: 100;
				border-top: 1px solid var(--border-color);
			}
			div#above-table {
				position: sticky;
				top: 0;
				background-color: var(--background-color);
				z-index: 100;
				border-bottom: 1px solid var(--border-color);
			}
			.sort {
				cursor: pointer;
				border: 1px solid rgb(183, 183, 183);
				border-radius: 5px;
				padding: .2rem .5rem;
				color: rgb(183, 183, 183);
			}
			button.sort[sort-direction=ascend]:after {
				content: '▲';
				font-size: .8rem;
				padding-left: .2rem;
			}
			button.sort[sort-direction=descend]:after {
				content: '▼';
				font-size: .8rem;
				padding-left: .2rem;
			}
			button {
				cursor: pointer;
				padding: .3rem .5rem;
				border: 1px solid rgb(183, 183, 183);
				border-radius: 5px;
				background-color: inherit;
			}
			button:hover {
				background-color: lightgray;
			}
			div#sort-buttons {
				display: flex;
				justify-content: flex-start;
				padding: .3rem .5rem;
				gap: .2rem;
			}
			#page-selector {
				padding: .2rem;
				margin-left: .5rem;
				background-color: inherit;
				border: 1px solid rgb(183, 183, 183);
			}
			slot {
				position: relative;
			}
		`
	}

	static get properties() {
		return {
			dataApiResponse: { type: Object },
			dataApiQuery: { type: Object },
			scriptName: { type: String, reflect: true, attribute: 'query-script' },
			webviewerName: { type: String, reflect: true, attribute: 'webviewer-name' },
			jsonPath: { type: String, reflect: true, attribute: 'json-path' },
			error: { type: String },
			queryLayout: { type: String, reflect: true, attribute: 'query-layout' },
			updateLayout: { type: String, reflect: true, attribute: 'update-layout' },
		}
	}

	get table() {
		return this.querySelector('table');
	}

	constructor() {
		super();
		this.queryController = new FmQueryController(this);
		this.headersArray = [];
		this.showSearchRow = false;
	}

	connectedCallback() {
		super.connectedCallback();
		const headers = this.table.querySelectorAll('th[field-name]');
		headers.forEach((header, index) => {
			header.addEventListener('click', this.sortByColumn.bind(this));
			if (header.hasAttribute('is-searchable')) {
				this.showSearchRow = true;
			}
			this.headersArray.push(header);
		});
	}

	render() {
		const task = this.queryController.queryTask;
		return [
			html`<div id=above-table>
				${this.sortRowTemplate(this.queryController.sortFields)}
				${this.pageButtonsTemplate()}
			</div>`,
			html`
				${task.render({
				initial: () => html`<div class='loading'>loading the component ...</div><slot></slot>`,
				pending: () => html`<div class='loading'>getting data ...</div><slot></slot>`,
				complete: (data) => [
					this.populateTable(data),
					html`<slot></slot>`,
				],
				error: (error) => [
					html`<div class='loading error'>error: ${error.error.default_message} code: ${error.error.code}</div>`,
					this.populateTable([]),
					html`<slot></slot>`,
				],
			})}
		`,
			html`<div id="record-info"><span id='record-count-span'>${this.queryController.offset} to ${Math.min(this.queryController.foundCount, this.queryController.limit * this.queryController.pageNumber)} of ${this.queryController.foundCount}</span></div>
		`]
	}

	populateTable(data) {

		// get the table for its headers
		const table = this.table;
		const tableHeader = table.querySelector('thead');
		const headers = Array.from(tableHeader.querySelectorAll('th'));
		const searchRow = html`${cache(this.showSearchRow ? this.searchRowTemplate(headers) : nothing)}`;

		let tableBody;

		if(!table.querySelector('tbody')) {
			tableBody = document.createElement('tbody');
			tableBody.addEventListener('keydown', this.onArrowKey);
		} else {
			tableBody = table.querySelector('tbody');
		}

		table.appendChild(tableBody);

		const rows = eval(`data.${this.jsonPath}`) || [];
		const recordControllerOptions = {
			dataApiScript: this.scriptName,
			queryLayout: this.queryLayout,
			updateLayout: this.updateLayout,
			webviewerName: this.webviewerName,
		}

		// generate rows template
		const rowsTemplate = html`
			${repeat(rows, (row) => row.recordId, (row, index) => {
				return html`
						<fm-portal-row 
							.recordData=${row}
							.headers=${headers}
							.index=${index}
							.controllerOptions=${recordControllerOptions}>
						</fm-portal-row>
					`
		})}
		`;

		// render the table
		render(html`
			${searchRow}
			${rowsTemplate}
		`, tableBody);

	}

	nextPage() {
		this.queryController.nextPage();
	}

	previousPage() {
		this.queryController.previousPage();
	}

	// event handlers
	changePage(e) {
		const pageNumber = e.target.value;
		this.queryController.getPage(pageNumber);
	}

	sortByColumn(e) {
		const column = e.target;
		const fieldName = column.getAttribute('field-name');
		const sortDirection = column.getAttribute('sort-direction');

		if (!fieldName) {
			return;
		}

		switch (sortDirection) {
			case 'ascend':
				column.setAttribute('sort-direction', 'descend');
				break;
			case 'descend':
				column.setAttribute('sort-direction', 'ascend');
				break;
			default:
				column.setAttribute('sort-direction', 'ascend');
				break
		}

		this.queryController.sortBy(fieldName, column.getAttribute('sort-direction'));

	}

	removeSortField(e) {
		const fieldName = e.target.getAttribute('field-name');
		this.queryController.sortBy(fieldName);

		// get the column
		const column = this.table.querySelector(`th[field-name="${fieldName}"]`);
		// remove the sort direction
		column.removeAttribute('sort-direction');
	}

	filterPortal(e) {
		const searchRow = this.table.querySelector('#search-row');
		const inputs = searchRow.querySelectorAll('input');
		const query = {};
		inputs.forEach(input => {
			if (!input.value) {
				return;
			}
			const fieldName = input.getAttribute('field-name');
			query[fieldName] = input.value;
		})
		this.queryController.filter(query);
	}

	onArrowKey(e) {

		const key = e.key;
		const focused = document.activeElement;
		const row = focused.closest('tr');
		const portalRow = focused.closest('fm-portal-row');
		const element = e.target;
		console.log('key', key, 'element', element, 'row', row, 'portalRow', portalRow);
		// determine if this is an input
		if((key === 'ArrowDown' || key === 'ArrowUp') && element.tagName === 'INPUT') {
			const cell = element.closest('td');
			const cellIndex = cell.cellIndex;
			const nextRow = key === 'ArrowDown' ? portalRow.nextElementSibling : portalRow.previousElementSibling;
			if(nextRow) {
				const nextCell = nextRow.querySelector(`td:nth-child(${cellIndex + 1})`);
				const nextInput = nextCell.querySelector('input');
				if(nextInput) {
					nextInput.focus();
				}
			}
		} else if ((key === 'ArrowDown' || key === 'ArrowUp') && element.tagName === 'TR') {
			const nextPortalRow = key === 'ArrowDown' ? portalRow.nextElementSibling : portalRow.previousElementSibling;
			const nextTableRow = nextPortalRow.querySelector('tr');
			if(nextTableRow) {
				nextTableRow.focus();
			}
			
		}

	}

	// templates
	searchRowTemplate(headersArray) {
		return html`
			<tr id='search-row'>
				${headersArray.map(header => {
			if (header.hasAttribute('is-searchable')) {
				return html`<td><input type='text' field-name=${header.getAttribute('field-name')} @change=${this.filterPortal.bind(this)} placeholder='filter...'></td>`
			}
			return html`<td></td>`;
		})}
			</tr>
		`
	}

	sortRowTemplate(sortFields) {
		return html`
			<div id='sort-buttons'>
				<div class='sort'>Sort by:</div>
				${sortFields.map(sortField => {
			const fieldName = sortField.fieldName;
			const direction = sortField.sortOrder;
			// get the header for this fieldname
			const header = this.table.querySelector(`th[field-name="${fieldName}"]`);
			const headerText = header.textContent;

			return html`<button class="sort" field-name=${fieldName} sort-direction=${direction} @click=${this.removeSortField}>${headerText}</button>`
		})}
			</div>
		`
	}

	pageButtonsTemplate() {
		const query = this.queryController;
		return html`
			<div id="page-buttons">
				<button @click=${this.previousPage} tabindex=0>prev</button>
				<div>
					<span id='page-number-span'>Page ${query.pageNumber} of ${query.totalPages}</span>
					<select id='page-selector' @change=${this.changePage}>
						${Array.from({ length: query.totalPages }, (_, i) => {
			const pageNumber = i + 1;
			return html`<option value=${pageNumber} ?selected=${pageNumber === query.pageNumber}>${pageNumber}</option>`
		})}
					</select>
				</div>
				<button @click=${this.nextPage} tabindex=0>next</button>
			</div>
		`
	}

}

window.customElements.define('fm-portal', FmPortal);