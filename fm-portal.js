import { LitElement, html, css, nothing } from 'https://cdn.skypack.dev/lit-element';
import { cache } from 'https://cdn.skypack.dev/lit/directives/cache.js';
import { render } from 'https://cdn.skypack.dev/lit-html';
import { FmQueryController } from './FileMaker.js';


export class FmPortal extends LitElement {

	static get styles() {
		return css`
			:host {
				position: relative;
				white-space: nowrap;
			}
			div.loading {
				position: absolute;
				top: -27px;
				left: 55px;
				z-index: 100;
				padding: .2rem .5rem;
				border: 1px solid rgb(183, 183, 183);
				border-radius: 5px;
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
				background-color: inherit;
				width: 100%;

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
			}
			button.sort[sort-direction=descend]:after {
				content: '▼';
				font-size: .8rem;
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
			this.sortRowTemplate(this.queryController.sortFields),
			this.pageButtonsTemplate(),
			html`
				${task.render({
				initial: () => html`<div class='loading'>loading the component ...</div><slot style="display: none"></slot>`,
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
			html`<div id="record-info"><span id='record-count-span'>${this.queryController.offset}...${Math.min(this.queryController.foundCount, this.queryController.limit * this.queryController.pageNumber)} of ${this.queryController.foundCount}</span></div>
		`]
	}

	populateTable(data) {

		// get the table for its headers
		const table = this.table;
		const tableHeader = table.querySelector('thead');
		const headers = Array.from(tableHeader.querySelectorAll('th'));
		const searchRow = html`${cache(this.showSearchRow ? this.searchRowTemplate(headers) : nothing)}`;

		// upsert the tbody
		const tableBody = table.querySelector('tbody') || document.createElement('tbody');
		table.appendChild(tableBody);

		const rows = eval(`data.${this.jsonPath}`) || [];

		// generate rows template
		const rowsTemplate = rows.reduce((acc, row, index) => {
			const rowId = row.recordId;
			const modId = row.modId;

			const rowTemplate = headers.reduce((acc, header) => {
				const path = header.getAttribute('json-path');
				const field = header.getAttribute('field-name');
				const scriptName = header.getAttribute('script-name');
				const label = header.getAttribute('label');
				const evalString = `row.${path}` + (field ? `['${field}']` : '');
				const value = eval(evalString);

				const clickHandler = () => {
					this.queryController.performScript({
						script: scriptName,
						params: { data: row, index, webviewer: this.webviewerName },
						webviewerName: this.webviewerName,
					})
				}

				if (scriptName) {
					return html`${acc}<td @click=${clickHandler}>${label}</td>`
				} else {
					return html`${acc}<td>${value}</td>`
				}


			}, html``);

			return html`${acc}<tr record-id=${rowId} mod-id=${modId} record-data=${row}>${rowTemplate}</tr>`

		}, html``);

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

	changePage(e) {
		console.log('change page', e.target.value);
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
		const column = this.table.querySelector(`th[field-name=${fieldName}]`);
		// remove the sort direction
		column.removeAttribute('sort-direction');
	}

	filterPortal(e) {
		const value = e.target.value;
		console.assert(this.table, 'table not found', this);
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

	searchRowTemplate(headersArray) {
		return html`
			<tr id='search-row'>
				${headersArray.map(header => {
			if (header.hasAttribute('is-searchable')) {
				return html`<td><input type='text' field-name=${header.getAttribute('field-name')} @change=${this.filterPortal.bind(this)}></td>`
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
			const header = this.table.querySelector(`th[field-name=${fieldName}]`);
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
				<button @click=${this.previousPage}>prev</button>
				<div>
					<span id='page-number-span'>Page ${query.pageNumber} of ${query.totalPages}</span>
					<select id='page-selector' @change=${this.changePage}>
						${Array.from({ length: query.totalPages }, (_, i) => {
							const pageNumber = i + 1;
							return html`<option value=${pageNumber} ?selected=${pageNumber === query.pageNumber}>${pageNumber}</option>`
						})}
					</select>
				</div>
				<button @click=${this.nextPage}>next</button>
			</div>
		`
	}
}

window.customElements.define('fm-portal', FmPortal);