import { Task } from 'https://cdn.skypack.dev/@lit/task';

class WebViewer {
	// Default script name for callback
	static callbackScript = 'callback (jsb)';

	// Script options for FileMaker PerformScriptWithOption
	static scriptOptions = {
		CONTINUE: '0',
		HALT: '1',
		EXIT: '2',
		RESUME: '3',
		PAUSE: '4',
		SUSPEND: '5',
	};

	// Enable or disable logging
	static loggingEnabled = true;

	/**
	 * Calls a FileMaker script and returns a result asynchronously.
	 * @param {Object} options - The options for the callback.
	 * @param {string} options.script - The name of the FileMaker script to call.
	 * @param {Object} options.params - The parameters to pass to the script.
	 * @param {string} [options.scriptOption=WebViewer.scriptOptions.SUSPEND] - The script option.
	 * @param {string} options.webviewerName - The name of the web viewer.
	 * @param {boolean} [options.performOnServer=false] - Whether to perform the script on the server.
	 * @returns {Promise} - A promise that resolves with the result of the script.
	 */
	static performScript({ script, params, scriptOption = WebViewer.scriptOptions.SUSPEND, webviewerName, performOnServer = false }) {
		// Validate required parameters
		if (!script) {
			return Promise.reject(new Error('No script provided'));
		}
		if (!webviewerName) {
			return Promise.reject(new Error('No webviewer name provided'));
		}

		return new Promise((resolve, reject) => {
			// Check if FileMaker object is available
			if (typeof FileMaker === 'undefined') {
				// Retry after 1 second if FileMaker is not defined
				setTimeout(() => {
					WebViewer.performScript({ script, params, scriptOption, webviewerName, performOnServer }).then(resolve).catch(reject);
				}, 1000);
				return;
			}

			// Create a unique function name for the callback
			const functionName = `callbackFunction${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
			window[functionName] = (result, parameter, error) => {
				// Clean up the function after it's called
				delete window[functionName];

				let parsedResult, parsedError;
				try {
					// Parse the JSON result and error
					if (result) parsedResult = JSON.parse(result);
					if (error) parsedError = JSON.parse(error);
				} catch (parsedError) {
					return reject(new Error('Error parsing callback result or error'));
				}

				// Log the result and error if logging is enabled
				if (WebViewer.loggingEnabled) {
					console.log('FileMaker callback:', { request: params, result: parsedResult, error: parsedError });
				}

				// Check for errors in the parsed result
				if (parsedError?.error_code || parsedError?.error?.code) {
					reject(parsedError);
				} else {
					resolve(parsedResult);
				}
			};

			// Prepare the callback parameters
			const callbackParameters = {
				script,
				params,
				callbackName: functionName,
				webviewerName,
				performOnServer,
			};

			// Ensure FileMaker object is defined before calling the script
			if (typeof FileMaker === 'undefined') {
				return reject(new Error('FileMaker object not found'));
			}

			// Perform the FileMaker script with the provided options
			FileMaker.PerformScriptWithOption(
				WebViewer.callbackScript,
				JSON.stringify(callbackParameters),
				scriptOption,
			);
		});
	}
}

class FmDapi {

	#username;
	#password;

	static instance;

	constructor(options) {

		// singleton class
		if (FmDapi.instance) {
			return FmDapi.instance;
		}

		FmDapi.instance = this;

		// set the options
		const { domain, database, version = 'Latest', username, password } = options;
		this.domain = domain || 'fm.mx.fxprofessionalservices.com';
		this.#username = username || 'admin';
		this.#password = password || 'bfFN66plAeY1Hpzg<Gfv';
		this.database = database || 'Integrator Edge';
		this.version = version;
		this.token = null;
	}

	#authenticate = async () => {
		const credentials = btoa(`${this.username}:${this.password}`);
		const authHeader = `Basic ${credentials}`;
		const response = await fetch(`https://${this.domain}/fmi/data/v${this.version}/databases/${this.database}/sessions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': authHeader,
			},
		});
		const data = await response.json();
		const token = data.response.token;
		this.token = token;
	}

	#transformToFetch = (query) => {

		// don't mutate the original query
		const queryCopy = { ...query };

		// extract these for the url
		const layout = query.layouts;
		const action = query.action;
		const recordId = query.recordId;

		// remove unneeded properties from query
		delete queryCopy.layouts;
		delete queryCopy.recordId;
		delete queryCopy.action;

		// prepare the fetch options
		let result;

		if (action == 'read') {
			result = {
				url: `https://${this.domain}/fmi/data/v${this.version}/databases/${this.database}/layouts/${layout}/_find`,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.token,
				},
				body: JSON.stringify(queryCopy),
			}
		} else if (action == 'update') {
			result = {
				url: `https://${this.domain}/fmi/data/v${this.version}/databases/${this.database}/layouts/${layout}/records/${recordId}`,
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.token,
				},
				body: JSON.stringify(queryCopy),
			}
		} else if (action == 'delete') {
			result = {
				url: `https://${this.domain}/fmi/data/v${this.version}/databases/${this.database}/layouts/${layout}/records/${recordId}`,
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.token,
				},
			}
		}

		return result;
	}

	performRequest = async (query) => {
		if (!this.token) {
			await this.#authenticate();
		}

		try {
			const fetchOptions = this.#transformToFetch(query);
			const response = await fetch(fetchOptions.url, fetchOptions);
			const result = await response.json();
			return result;
		} catch (error) {
			console.error('Error fetching data', error);
			if (response.status === 401) {
				this.#authenticate();
				// retry the fetch
				try {
					const response = await fetch(fetchOptions.url, fetchOptions);
					const result = await response.json();
					return result;
				} catch (error) {
					console.error('Error during re-auth', error);
					throw error;
				}
			}
		}
	}

}

// FileMaker Query Controller
// This class is used to manage the state of a FileMaker query
// and to perform the query using the WebViewer class
class FmQueryController {

	#hostUrl = 'https://fm.mx.fxprofessionalservices.com/fmi/data/vLatest/databases/Integrator Edge/layouts/';

	constructor(host) {
		// Store a reference to the host
		this.host = host;
		// Register for lifecycle updates
		host.addController(this);
		console.log('registering controller', this);

		this.limit = 10;
		this.offset = 1;
		this.pageNumber = 1;
		this.totalPages = 1;
		this.foundCount = 0;
		this.sortFields = [];
		this.token = null;
		this.dapi = new FmDapi({
			username: 'admin',
			password: 'bfFN66plAeY1Hpzg<Gfv',
			domain: 'fm.mx.fxprofessionalservices.com',
			database: 'Integrator Edge',
		});

		// Create a task for the query
		this.queryTask = new Task(host, {
			task: async ([query]) => {
				// Check if the query is empty
				if (!query) {
					return;
				}
				if (query.limit) {
					this.limit = query.limit;
				}
				if (query.offset) {
					this.offset = query.offset;
				}
				if (query.sort) {
					this.sortFields = query.sort;
				}
				if (query.query.length) {
					this.query = query.query;
				}

				this.request = query;

				let result, response;

				if (this.host.platform === 'web') {
					// perform the web request
					try {
						result = await this.dapi.performRequest(query);
					} catch (error) {
						console.error('Error fetching data', error);
					}
				} else {
					// perform the FileMaker script
					result = await WebViewer.performScript({
						script: this.host.scriptName,
						params: query,
						webviewerName: this.host.webviewerName,
						scriptOption: WebViewer.scriptOptions.SUSPEND,
						performOnServer: false,
					});
				}

				result = result.response || result;

				if (result.dataInfo) {
					this.foundCount = result.dataInfo.foundCount;
					this.totalPages = Math.ceil(this.foundCount / this.limit);
				}

				// Store the response
				host.dataApiResponse = result;

				// Return the response
				return result;
			},
			args: () => [host.dataApiQuery],
		});
	}

	set query(value) {
		if (!this._query && value.length) {
			this.firstQuery = value;
		}
		this._query = value;
	}

	get query() {
		return this._query;
	}

	getPage(pageNumber) {
		pageNumber = Number(pageNumber);

		// ensure page is within bounds
		if (pageNumber < 1) {
			pageNumber = 1;
		}

		if (pageNumber > this.totalPages) {
			pageNumber = this.totalPages;
		}

		this.pageNumber = pageNumber;

		this.offset = Math.max((pageNumber - 1) * this.limit, 1);
		this.host.dataApiQuery = {
			...this.host.dataApiQuery,
			limit: this.limit,
			offset: this.offset
		};
		this.queryTask.run();
	}

	nextPage() {
		this.getPage(Number(this.pageNumber) + 1);
	}

	previousPage() {
		this.getPage(this.pageNumber - 1);
	}

	refresh() {
		this.queryTask.run();
	}

	sortBy(fieldName, sortOrder) {
		// check if field is already sorted
		const index = this.sortFields.findIndex((sortField) => sortField.fieldName === fieldName);

		if (index > -1 && sortOrder) {
			// reverse the sort direction
			this.sortFields[index].sortOrder = sortOrder;
		} else if (index > -1) {
			// remove the field from the sort
			this.sortFields.splice(index, 1);
		} else {
			// add the field to the sort
			this.sortFields.push({ fieldName, sortOrder: sortOrder || 'ascend' });
		}
		this.pageNumber = 1;
		const nextQuery = { ...this.host.dataApiQuery, offset: 1 };

		if (this.sortFields.length) {
			nextQuery.sort = this.sortFields;
		} else {
			delete nextQuery.sort;
		}

		this.host.dataApiQuery = nextQuery;
		this.queryTask.run();
	}

	filter(query) {
		this.pageNumber = 1;
		// merge the new query with the existing query
		const newQuery = [];
		this.firstQuery.forEach((item) => {
			newQuery.push({ ...query, ...item });
		});
		this.host.dataApiQuery = { ...this.host.dataApiQuery, query: newQuery, offset: 1 };
		this.queryTask.run();
	}

	authenticate = async () => {
		const username = 'admin';
		const password = 'bfFN66plAeY1Hpzg<Gfv';
		const credentials = btoa(`${username}:${password}`);
		const authHeader = `Basic ${credentials}`;
		const response = await fetch('https://fm.mx.fxprofessionalservices.com/fmi/data/vLatest/databases/Integrator Edge/sessions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': authHeader,
			},
		});
		const data = await response.json();
		const token = data.response.token;
		this.token = token;
		return token
	}

	transformToFetch = (query) => {
		// remove unneeded properties from query
		const queryCopy = { ...query };
		const layout = query.layouts;
		const action = query.action;
		const recordId = query.recordId;
		delete queryCopy.layouts;
		delete queryCopy.recordId;
		delete queryCopy.action;
		let result = {};

		if (action == 'read') {
			result = {
				url: `https://fm.mx.fxprofessionalservices.com/fmi/data/vLatest/databases/Integrator Edge/layouts/${layout}/_find`,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.token,
				},
				body: JSON.stringify(queryCopy),
			}
		} else if (action == 'update') {
			result = {
				url: `https://fm.mx.fxprofessionalservices.com/fmi/data/vLatest/databases/Integrator Edge/layouts/${layout}/records/${recordId}`,
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.token,
				},
				body: JSON.stringify(queryCopy),
			}
		} else if (action == 'delete') {
			result = {
				url: `https://fm.mx.fxprofessionalservices.com/fmi/data/vLatest/databases/Integrator Edge/layouts/${layout}/records/${recordId}`,
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer ' + this.token,
				},
			}
		}
		console.log('transform', query, result)
		return result;
	}

	performScript(options){
		options.webviewerName = this.host.webviewerName;
		return WebViewer.performScript(options);
	}
}

// Controller for managing a FileMaker record
// This class is used to manage the state of a FileMaker record
// and to perform create, read, update, and delete operations
// using the WebViewer class
// it sends and updates the recordData property of the host
class FmRecordController {
	constructor(host, options) {

		// Store a reference to the host
		this.host = host;
		
		// Register for lifecycle updates
		host.addController(this);

		this.dataApiScript = options.dataApiScript;
		this.updateLayout = options.updateLayout;
		this.queryLayout = options.queryLayout;
		this.webviewerName = options.webviewerName;

		this.dapi = new FmDapi({
			username: 'admin',
			password: 'bfFN66plAeY1Hpzg<Gfv',
			domain: 'fm.mx.fxprofessionalservices.com',
			database: 'Integrator Edge',
		});
	}

	updateRecord = async (recordData) => {
		try {
			let result;

			const options = {
				script: this.dataApiScript,
				params: {
					...recordData,
					recordId: parseInt(this.host.recordId),
					layouts: this.updateLayout,
					action: 'update',
				},
				webviewerName: this.webviewerName,
				scriptOption: WebViewer.scriptOptions.SUSPEND,
				performOnServer: false,
			}

			if (this.host.platform === 'web') {
				result = await this.dapi.performRequest(options.params);
			} else {
				result = await WebViewer.performScript(options);
			}

			// merge the FIELDS object from recordData with the one from recordData
			// the FM Data api only returns the modId after a successful update
			const newFields = recordData.fieldData;
			const oldFields = this.host.recordData.fieldData;
			const mergedFields = { ...oldFields, ...newFields };
			this.host.recordData = { ...this.host.recordData, fieldData: mergedFields, modId: result.modId };

			// reset the isUpdated flag to disable the save button
			this.host.isUpdated = false;

		} catch (error) {
			console.error('Error updating record', error);
			throw error;
		}
	};

	deleteRecord = async () => {
		try {
			let result;

			const options = {
				script: this.dataApiScript,
				params: {
					recordId: parseInt(this.host.recordId),
					layouts: this.updateLayout,
					action: 'delete',
				},
				webviewerName: this.webviewerName,
				scriptOption: WebViewer.scriptOptions.SUSPEND,
				performOnServer: false,
			}

			if (this.host.platform === 'web') {
				result = await this.dapi.performRequest(options.params);
			} else {
				result = await WebViewer.performScript(options);
			}

			// reset the recordData property
			this.host.recordData = {};

		} catch (error) {
			console.error('Error deleting record', error);
			throw error;
		}
	}

	performScript = WebViewer.performScript.bind(this);

}

export { WebViewer, FmQueryController, FmRecordController }; // Export the WebViewer class for use in other modules