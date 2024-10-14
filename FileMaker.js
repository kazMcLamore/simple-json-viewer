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
			const functionName = `callbackFunction${Date.now()}`;
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
					console.log('FileMaker callback:', { result: parsedResult, error: parsedError });
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

export { WebViewer }; // Export the WebViewer class for use in other modules