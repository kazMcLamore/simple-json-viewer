import { LitElement, html, css, nothing } from 'https://cdn.skypack.dev/lit-element';
import { cache } from 'https://cdn.skypack.dev/lit/directives/cache.js';
import { render } from 'https://cdn.skypack.dev/lit-html';
import { FmQueryController } from './FileMaker.js';


export class FmPortal extends LitElement {

	static get styles() {
		return css`
			:host {
				position: relative;
				padding: 1rem;
			}
			.loading {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: .5rem .5rem;
			}
			.error {
				color: red;
			}
			div#page-buttons {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: .5rem .5rem;
			}
			div#record-info {
				text-align: center;
				padding: 1rem 0;
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
		return [
			html`
				<div id='sort-buttons'><span class='sort'>Sort by:</span>
				${this.queryController.sortFields.map(sortField => {
				const fieldName = sortField.fieldName;
				const direction = sortField.sortOrder;
				// get the header for this fieldname
				const header = this.table.querySelector(`th[field-name=${fieldName}]`);
				const headerText = header.textContent;

				return html`<button class="sort" field-name=${fieldName} sort-direction=${direction} @click=${this.removeSortField}>${headerText}
						</button>`
				})}
				</div>`,
			html`<div id="page-buttons">
				<button @click=${this.previousPage}>prev</button>
				<span id='page-number-span'>Page ${this.queryController.pageNumber} of ${this.queryController.totalPages}</span>
				<button @click=${this.nextPage}>next</button>
				</div>
					<slot></slot>
				<div id="record-info"><span id='record-count-span'>${this.queryController.offset}...${Math.min(this.queryController.foundCount, this.queryController.limit * this.queryController.pageNumber)} of ${this.queryController.foundCount}</span></div>
				`,
			html`
				${this.queryController.queryTask.render({
				initial: () => html`<div class='loading'>loading the component ...</div><slot style="display: none"></slot>`,
				pending: () => html`<div class='loading'>getting data ...</div><slot></slot>`,
				complete: () => [,
					this.populateTable(),
			],
			error: (error) => html`<div class='error'>${error}</div><slot></slot>`,
		})}
		`,]
	}

	populateTable() {
		this.error = '';

		// get the table for its headers
		const table = this.table;
		const tableHeader = table.querySelector('thead');
		const headers = tableHeader.querySelectorAll('th');
		const searchRow = html`${cache(this.showSearchRow ?  this.searchRowTemplate(): nothing)}`;

		// upsert the tbody
		const tableBody = table.querySelector('tbody') || document.createElement('tbody');

		// remove rows
		tableBody.replaceChildren();
		console.log('headers', headers, searchRow, this.showSearchRow);
		if (this.showSearchRow) { 
			render(searchRow, tableBody);
		}

		// this will have been set by the controller
		const data = this.dataApiResponse

		const rows = eval(`data.${this.jsonPath}`);
		if (!rows) {
			this.error = `No data found at path: ${this.jsonPath}`;
			console.error('No data found', this);
			return;
		}

		rows.forEach(row => {
			// create a row
			const tr = document.createElement('tr');
			headers.forEach(header => {
				// create a td
				const td = document.createElement('td');
				// get the path from the header
				const path = header.getAttribute('json-path');
				const field = header.getAttribute('field-name');
				// set the text content of the td to the value at the path
				const evalString = `row.${path}` + (field ? `['${field}']` : '');
				try {
					td.textContent = eval(evalString);
				} catch (error) {
					console.error(`Error evaluating string: ${evalString}`);
					console.error(error);
					td.textContent = 'Error';
					return;
				}
				// append the td to the tr
				tr.appendChild(td);
			})
			// append the tr to the tbody
			tableBody.appendChild(tr);
		})
		// append the updated tbody to the table
		table.appendChild(tableBody);
	}

	nextPage() {
		this.queryController.nextPage();
	}
	previousPage() {
		this.queryController.previousPage();
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

	searchRowTemplate() {
		return html`
			<tr id='search-row'>
				${this.headersArray.map(header => {
			if (header.hasAttribute('is-searchable')) {
				return html`<td><input type='text' field-name=${header.getAttribute('field-name')} @change=${this.filterPortal}></td>`
			}
			return html`<td></td>`;
		})}
			</tr>
		`
	}
}

window.customElements.define('fm-portal', FmPortal);