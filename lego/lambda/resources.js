/*
 * This are the resources part of the Lambda function that represents the endpoint of the Alexa Lego Mindstorms challenge skill.
 * The code can be copied and used without restriction.
 * This skill send directives and receive events from the Lego Mindstorm Brick Echo connected gadget.
 * The code may contain parts copied from Alexa Lego Mindstorms mission 4.
 */

'use strict';

const Https = require('https');
const AWS = require('aws-sdk');
const Escape = require('lodash/escape');
const speech_en_US = require("./speech/en-US.json");
const speech_es_ES = require("./speech/es-ES.json");
const image = require("./images/images.json");

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';


/**
 * Builds a directive to start the EventHandler.
 * @param token - a unique identifier to track the event handler
 * @param {number} timeout - the duration to wait before sending back the expiration
 * payload to the skill.
 * @param payload - the expiration json payload
 * @see {@link https://developer.amazon.com/docs/alexa-gadgets-toolkit/receive-custom-event-from-gadget.html#start}
 */
exports.buildStartEventHandler = function (token, timeout = 30000, payload) {
    return {
        type: "CustomInterfaceController.StartEventHandler",
        token: token,
        expiration: {
            durationInMilliseconds: timeout,
            expirationPayload: payload
        }
    };
};

/**
 *
 * Builds a directive to stops the active event handler.
 * The event handler is identified by the cached token in the session attribute.
 * @param {string} handlerInput - the JSON payload from Alexa Service
 * @see {@link https://developer.amazon.com/docs/alexa-gadgets-toolkit/receive-custom-event-from-gadget.html#stop}
 */
exports.buildStopEventHandlerDirective = function (handlerInput) {

    let token = handlerInput.attributesManager.getSessionAttributes().token || '';
    return {
        "type": "CustomInterfaceController.StopEventHandler",
        "token": token
    }
};

/**
 * Build a custom directive payload to the gadget with the specified endpointId
 * @param {string} endpointId - the gadget endpoint Id
 * @param {string} namespace - the namespace of the skill
 * @param {string} name - the name of the skill within the scope of this namespace
 * @param {object} payload - the payload data
 * @see {@link https://developer.amazon.com/docs/alexa-gadgets-toolkit/send-gadget-custom-directive-from-skill.html#respond}
 */
exports.build = function (endpointId, namespace, name, payload) {
    // Construct the custom directive that needs to be sent
    // Gadget should declare the capabilities in the discovery response to
    // receive the directives under the following namespace.
    return {
        type: 'CustomInterfaceController.SendDirective',
        header: {
            name: name,
            namespace: namespace
        },
        endpoint: {
            endpointId: endpointId
        },
        payload
    };
};

/**
 * A convenience routine to add the a key-value pair to the session attribute.
 * @param handlerInput - the handlerInput from Alexa Service
 * @param key - the key to be added
 * @param value - the value be added
 */
exports.putSessionAttribute = function (handlerInput, key, value) {
    const attributesManager = handlerInput.attributesManager;
    let sessionAttributes = attributesManager.getSessionAttributes();
    sessionAttributes[key] = value;
    attributesManager.setSessionAttributes(sessionAttributes);
};

/**
 * To get a list of all the gadgets that meet these conditions,
 * Call the Endpoint Enumeration API with the apiEndpoint and apiAccessToken to
 * retrieve the list of all connected gadgets.
 *
 * @param {string} apiEndpoint - the Endpoint API url
 * @param {string} apiAccessToken  - the token from the session object in the Alexa request
 * @see {@link https://developer.amazon.com/docs/alexa-gadgets-toolkit/send-gadget-custom-directive-from-skill.html#call-endpoint-enumeration-api}
 */
exports.getConnectedEndpoints = function (apiEndpoint, apiAccessToken) {

    // The preceding https:// need to be stripped off before making the call
    apiEndpoint = (apiEndpoint || '').replace('https://', '');

    return new Promise(((resolve, reject) => {

        const options = {
            host: apiEndpoint,
            path: '/v1/endpoints',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiAccessToken
            }
        };

        const request = Https.request(options, (response) => {
            response.setEncoding('utf8');
            let returnData = '';
            response.on('data', (chunk) => {
                returnData += chunk;
            });

            response.on('end', () => {
                resolve(JSON.parse(returnData));
            });

            response.on('error', (error) => {
                reject(error);
            });
        });
        request.end();
    }));
};

// returns the slot value in case the user used a synonym
exports.getSlotValueResolved = function (slots, name) {
    if (slots[name].resolutions) {
        return slots[name].resolutions.resolutionsPerAuthority[0].values[0].value.name
    } else {
        return slots[name].value
    }
};

// Calculate the Datasource, Commands, Directives and SpeechOutput to use when responding with the Sequence Document to the different User directives
exports.calculateSequenceDatasource = function (handlerInput, value) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();
    const endpointId = sessionAttributes.endpointId;

    let speech, voice, directive;
    switch (handlerInput.requestEnvelope.request.locale) {
        case "en-US":
            speech = speech_en_US;
            voice = "Justin";
            break;
        case "es-ES":
            speech = speech_es_ES;
            voice = "Enrique";
            break;
        default:
            speech = speech_en_US;
            voice = "Brian";
            break;
    }


    if (value) {
        let datasource = {
            lego: {
                properties: {
                    images: {
                        listImages: []
                    },
                    text: {
                        listText: []
                    }
                },
                transformers: []
            }
        };
        let commands = [{
            type: "Sequential",
            commands: []
        }];

        const speed = sessionAttributes.speed || "normal";
        const conversion = {
            "fast": 100,
            "slow": 20,
            "normal": 50
        }
        const speedNumber = conversion[speed];
        var speechOutput = [];
        var finalTool;
        var images = [];
        var place;
        var color;
        switch (value) {
            case "ChangeTool":
                const initialTool = sessionAttributes.initialTool;
                if (initialTool == "undefined") {
                    initialTool = "not known"
                }
                finalTool = sessionAttributes.finalTool;
                speechOutput[0] = speech["speak" + value][0] + initialTool + ". ";
                speechOutput[1] = speech["speak" + value][1] + finalTool + ". ";
                images[0] = image["image" + value][0] + initialTool + ".jpg";
                images[1] = image["image" + value][1] + finalTool + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'changeTool',
                    tool: finalTool
                });
                break;
            case "UseTool":
                finalTool = sessionAttributes.finalTool;
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + finalTool + speech["speak" + value][1] + ".</voice> ";
                images[0] = image["image" + value][0] + finalTool + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'useTool',
                    tool: finalTool
                });
                break;
            case "NotRightTool":
                finalTool = sessionAttributes.finalTool;
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + finalTool + speech["speak" + value][1] + ".</voice> ";
                images[0] = image["image" + value][0] + finalTool + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'notRightTool',
                    tool: finalTool
                });
                break;
            case "GoSomewhere":
                place = sessionAttributes.place;
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + place + ".</voice> ";
                images[0] = image["image" + value][0] + place + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'goSomewhere',
                    place: place,
                    speed: speedNumber
                });
                break;
            case "AlreadyThere":
                place = sessionAttributes.place;
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + ".</voice> ";
                images[0] = image["image" + value][0] + place + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'alreadyThere',
                    place: place
                });
                break;
            case "FindColor":
                color = sessionAttributes.color;
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + color + ".</voice> ";
                images[0] = image["image" + value][0] + color + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'findColor',
                    color: color,
                    speed: speedNumber
                });
                break;
            case "SetSpeed":
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + speed + ".</voice> ";
                images[0] = image["image" + value][0] + speed + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'setSpeed',
                    speed: speedNumber
                });
                break;
            case "SetTarget":
                const target = sessionAttributes.target;
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + target + ". </voice> ";
                images[0] = image["image" + value][0] + target + ".jpg";
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'setTarget',
                    target: target,
                    speed: speedNumber
                });
                break;
            case "NoGadget":
                speechOutput = speech["speak" + value];
                images = image["image" + value];
                directive = null;
                break;
            case ("NoFindColorEvent" || "HomeButtonEvent"):
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + ". </voice> ";
                images = image["image" + value];
                directive = null;
                break;
            case ("FindColorEvent"):
                const payload = handlerInput.requestEnvelope.request.events[0].payload;
                color = sessionAttributes.color;
                if (color == payload.color) {
                    value = "FindColorTargetEvent"
                }
                speechOutput[0] = "<voice name='" + voice + "'> " + speech["speak" + value][0] + payload.color + ". </voice>";
                images[0] = image["image" + value][0];
                directive = null;
                break;
            case "NoPositionKnown":
                speechOutput = speech["speak" + value];
                images = image["image" + value];
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'noPositionKnown'
                });
                break;
            default:
                speechOutput = speech["speak" + value];
                images = image["image" + value];
                directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
                    type: 'alexaTalk'
                });
        };

        let speechOutputText = "";

        for (var j = 0; j < speechOutput.length; j++) {
            const ssmlSpeechOutput = "<speak>" + speechOutput[j] + "</speak>";
            speechOutputText += speechOutput[j];
            datasource.lego.properties.text.listText[j] = {
                ssml: ssmlSpeechOutput,
                speechText: speechOutput[j]
            };
            datasource.lego.transformers[j] = {
                inputPath: "text.listText[" + j + "].ssml",
                outputName: "speech",
                transformer: "ssmlToSpeech"
            };

            if (j == 0) {
                commands[0].commands[0] = {
                    type: "SpeakItem",
                    componentId: "speechPlaceHolderText1"
                };
            } else {
                commands[0].commands[j] = {
                    type: "Parallel",
                    commands: [{
                            type: "Scroll",
                            componentId: "vSequenceId",
                            distance: 1
                        },
                        {
                            type: "SpeakItem",
                            componentId: "speechPlaceHolderText" + (j + 1)
                        }
                    ]
                };
            };
        };
        for (var m = 0; m < images.length; m++) {
            datasource.lego.properties.images.listImages[m] = {
                image: images[m]
            };
        }
        sessionAttributes.momment = value;

        const returnValue = {
            datasource: datasource,
            commands: commands,
            speechOutput: speechOutputText,
            directive: directive
        };
        return returnValue;
    }
};

// Calculate the Datasource and SpeechOutput to use when responding with the Arrows Document when user opens the Alexa Echo display remote control
exports.getRemoteControl = function (handlerInput) {
    let speech;
    switch (handlerInput.requestEnvelope.request.locale) {
        case "en-US":
            speech = speech_en_US;
            break;
        case "es-ES":
            speech = speech_es_ES;
            break;
        default:
            speech = speech_en_US;
    }
    let speechOutput;
    let datasource;
    if (exports.supportsAPL(handlerInput)) {
        speechOutput = speech.speakRemoteContol[0];

        datasource = {
            lego: {
                properties: {
                    images: {
                        imageBackground: image.imageArrows.imageBackground,
                        arrow_up: image.imageArrows.arrow_up,
                        arrow_down: image.imageArrows.arrow_down,
                        arrow_left: image.imageArrows.arrow_left,
                        arrow_right: image.imageArrows.arrow_right
                    }
                }
            }
        };
    } else {
        speechOutput = speech.speakNoDisplay[0];
        datasource = {};
    }
    const returnValue = {
        datasource: datasource,
        speechOutput: speechOutput
    };
    return returnValue;
};

// Calculate the Datasource, Directive and SpeechOutput to use when user touch the Alexa Echo Display arrow to make the robot move
exports.getClicked = function (handlerInput) {
    const attributesManager = handlerInput.attributesManager;
    const sessionAttributes = attributesManager.getSessionAttributes();
    const endpointId = sessionAttributes.endpointId;

    let speech;
    switch (handlerInput.requestEnvelope.request.locale) {
        case "en-US":
            speech = speech_en_US;
            break;
        case "es-ES":
            speech = speech_es_ES;
            break;
        default:
            speech = speech_en_US;
    }

    const clickedValue = handlerInput.requestEnvelope.request.arguments[0];
    let speed = sessionAttributes.speed || "normal";
    const conversion = {
        "fast": 100,
        "slow": 20,
        "normal": 50
    }
    let speedNumber = conversion[speed];

    const speechOutput = clickedValue;
    const datasource = {
        lego: {
            properties: {
                images: {
                    imageBackground: image.imageArrows.imageBackground,
                    arrow_up: image.imageArrows.arrow_up,
                    arrow_down: image.imageArrows.arrow_down,
                    arrow_left: image.imageArrows.arrow_left,
                    arrow_right: image.imageArrows.arrow_right
                }
            }
        }
    };

    const directive = exports.build(endpointId, NAMESPACE, NAME_CONTROL, {
        type: 'moveRemote',
        direction: clickedValue,
        speed: speedNumber
    });

    const returnValue = {
        datasource: datasource,
        speechOutput: speechOutput,
        directive: directive
    };
    return returnValue;
};

// returns true if the skill is running on a device with a display supporting APL (show|spot)
exports.supportsAPL = function (handlerInput) {
    const supportedInterfaces =
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces;
    const aplInterface = supportedInterfaces["Alexa.Presentation.APL"];
    return aplInterface != null && aplInterface !== undefined;
};