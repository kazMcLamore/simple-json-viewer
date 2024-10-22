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

// FileMaker Query Controller
// This class is used to manage the state of a FileMaker query
// and to perform the query using the WebViewer class
class FmQueryController {

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

				// Perform the FileMaker script
				const result = await WebViewer.performScript({
					script: this.host.scriptName,
					params: query,
					webviewerName: this.host.webviewerName,
					scriptOption: WebViewer.scriptOptions.SUSPEND,
					performOnServer: false,
				});

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

	performScript = WebViewer.performScript.bind(this);
}

// Controller for managing a FileMaker record
// This class is used to manage the state of a FileMaker record
// and to perform create, read, update, and delete operations
// using the WebViewer class
// it sends and updates the recordData property of the host
class FmRecordController {
	constructor(host, options) {
		this.host = host;
		// Register for lifecycle updates
		host.addController(this);

		this.dataApiScript = options.dataApiScript;
		this.updateLayout = options.updateLayout;
		this.queryLayout = options.queryLayout;
		this.webviewerName = options.webviewerName;
		// console.log('controller mounted', options)
	}

	// create a method for updating the record
	updateRecord = async (recordData) => {
		try {
			// Perform the FileMaker script
			const result = await WebViewer.performScript({
				script: this.dataApiScript,
				params: {
					...recordData, // fieldData and possibly portalData
					recordId: parseInt(this.host.recordId),
					// modId: parseInt(this.host.modId),
					layouts: this.updateLayout,
					action: 'update',
				},
				webviewerName: this.webviewerName,
				scriptOption: WebViewer.scriptOptions.SUSPEND,
				performOnServer: false,
			});

			// merge the FIELDS object from recordData with the one from recordData
			const newFields = recordData.fieldData;
			const oldFields = this.host.recordData.fieldData;
			const mergedFields = { ...oldFields, ...newFields };
			this.host.recordData = { ...this.host.recordData, fieldData: mergedFields, modId: result.modId };

			// reset the isUpdated flag to disable the save button
			this.host.isUpdated = false;

		} catch (error) {
			console.error('Error updating record', error, this.dataApiScript, recordData);
			throw error;
		}
	};

	performScript = WebViewer.performScript.bind(this);

}

export { WebViewer, FmQueryController, FmRecordController }; // Export the WebViewer class for use in other modules