/********************************************************************************
 * Copyright (C) 2020 CoCreate LLC and others.
 *
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

/** */
import observer from "@cocreate/observer";
import localStorage from "@cocreate/local-storage";

const themes = ["light", "dark"];
const mediaRangeNames = ["xs", "sm", "md", "lg", "xl"];
const ranges = {
	xs: [0, 575],
	sm: [576, 768],
	md: [769, 992],
	lg: [993, 1200],
	xl: [1201, 0]
};
const rangesArray = Object.values(ranges);

let classNameList = new Map();

let tempStyleList = [];
let parsedCSS = [];
let linkCSS = [];
let themeCSS = { dark: [], light: [] };
let styleElSheet;
let parse;

function init(linkTag) {
	if (linkTag) {
		parse = linkTag.getAttribute("parse");

		let styleEl = document.createElement("style");
		styleEl.setAttribute("component", "css-parser");
		document.head.appendChild(styleEl);
		styleElSheet = styleEl.sheet;

		// TODO get from @cocreate/config
		if (!parse && parse !== false)
			parse = localStorage.getItem("cssParser");
		if (parse === "false" || parse === false) return;

		parseLinkCSS();

		linkTag.getValue = () => {
			const onlyUnique = (value, index, self) => {
				return self.indexOf(value) === index;
			};

			const urlObject = new URL(linkTag.href);
			const pathParts = urlObject.pathname.split("/");

			let data = {};
			data.name = pathParts[pathParts.length - 1];
			data.path = urlObject.pathname.replace(data.name, "");
			data.pathname = urlObject.pathname;
			data.src = parsedCSS
				.concat(linkCSS)
				.filter(onlyUnique)
				.join("\r\n");
			data["content-type"] = "text/css";

			return data;
		};

		if (parse === "true" || parse === true) {
			let elements = document.querySelectorAll("[class]");
			initElements(elements);
		}

		observerInit();
	}
}

function initElements(elements) {
	for (let element of elements) initElement(element);
	addNewRules();
}

function initElement(element) {
	parseClassList(element.classList);
	createThemeMedia();
	if (element.hasAttribute("className")) {
		let rule =
			"." +
			element.getAttribute("className") +
			" { " +
			element
				.getAttribute("class")
				.replace(/ /g, "; ")
				.replace(/:/g, ": ") +
			"; }";
		tempStyleList.push(rule);
	}
}

function parseLinkCSS() {
	if (linkTag && linkTag.sheet) {
		let Rules = linkTag.sheet.cssRules;
		if (Rules)
			for (let rule of Rules) {
				try {
					linkCSS.push(rule.cssText);
					if (rule.selectorText) {
						classNameList.set(
							rule.selectorText.replace(/[.\\]/g, ""),
							true
						);
					} else {
						// TODO: handle media queriesand add to classNameList to avoid duplicate parsing
					}
				} catch (err) {
					console.error(err);
				}
			}
	}
}

function parseClassList(classList) {
	for (let className of classList) {
		if (classNameList.has(className)) continue;

		if (className.includes("@dark") || className.includes("@light")) {
			createThemeRule(className);
		} else if (className.includes(":")) {
			if (className.includes("@")) {
				createMediaRule(className);
			} else {
				let rule = createRule(className);
				tempStyleList.push(rule);
				classNameList.set(className, true);
			}
		}
	}
}

function createRule(className) {
	let important = "";
	let importantSuffix = "";
	if (className.includes("!important")) {
		[className, important] = className.split("!");
		important = "!" + important;
		importantSuffix = parseValue(important);
		important = "!important";
	}
	let res = className.split(":");
	let property = res[0];
	let suffix = parseValue(res[1]);
	let value = res[1].split("@")[0].replace(/_/g, " ");

	let rule = "";
	if (res.length > 2) {
		for (let i = 0; i < res.length - 2; i++) {
			suffix += "\\:" + res[2 + i] + importantSuffix + ":" + res[2];
		}
		rule = `.${property}\\:${suffix} { ${property}: ${value}${important}; }`;
	} else {
		rule = `.${property}\\:${suffix}${importantSuffix} { ${property}: ${value}${important}; }`;
	}
	return rule;
}

function parseValue(value) {
	return value
		.replace(/\./g, "\\.")
		.replace(/%/g, "\\%")
		.replace(/@/g, "\\@")
		.replace(/\(/g, "\\(")
		.replace(/\)/g, "\\)")
		.replace(/#/g, "\\#")
		.replace(/,/g, "\\,")
		.replace(/!/g, "\\!")
		.replace(/\//g, "\\/")
		.replace(/\"/g, '\\"')
		.replace(/\'/g, "\\'");
}

function createMediaRule(className) {
	let parts = className.split("@");
	let main_rule = createRule(className);

	for (let i = 1; i < parts.length; i++) {
		let range_num = mediaRangeNames.indexOf(parts[i]);
		let range = [];
		if (range_num != -1) range = rangesArray[range_num];
		else {
			let customRange = parts[i].split("-");
			range = customRange.map((c) => Number.parseInt(c));
		}
		let prefix = "@media screen";
		if (range[0] != 0) {
			prefix += " and (min-width:" + range[0] + "px)";
		}
		if (range[1] != 0) {
			prefix += " and (max-width:" + range[1] + "px)";
		}
		let rule = prefix + " {  " + main_rule + "}";
		tempStyleList.push(rule);
		classNameList.set(className, true);
	}
}

function createThemeRule(className) {
	let classname = className;
	let pseudo, theme;
	[className, theme] = className.split("@");

	if (theme.includes(":")) {
		theme = theme.split(":");
		pseudo = theme;
		theme = theme[0];
		pseudo.shift();
	}
	let important = "";
	let importantSuffix = "";
	if (className.includes("!important")) {
		[className, important] = className.split("!");
		important = "!" + important;
		importantSuffix = parseValue(important);
		important = "!important";
	}

	let res = className.split(":");
	// if (res.length > 2) {
	//     console.log('pseudo names need to be added after theme');
	//     return;
	// }
	let property = res[0];
	let suffix = parseValue(res[1]);
	let value = res[1].replace(/_/g, " ");

	//TODO: set theme rule with pseudo and !important
	let rule = "";
	if (res.length > 2) {
		// suffix += "\\@" + theme;
		// for (let i = 0; i < res.length - 2; i++) {
		suffix +=
			"\\:" +
			res[2] +
			importantSuffix +
			":" +
			"\\@" +
			theme +
			":" +
			res[2];
		// }
		rule = `.${property}\\:${suffix} { ${property}: ${value}${important}; }`;
	} else {
		rule = `.${property}\\:${suffix}\\@${theme} { ${property}: ${value}; }`;
	}

	if (theme == "dark" || theme == "light") {
		// rule = `[theme="${theme}"] ${rule}`;
		// let reverseRule = `html:not([theme="${themes[1 - themes.indexOf(theme)]}"]) ${rule}`;
		// let reverseRule = `${rule}`;
		// tempStyleList.push(rule);
		themeCSS[theme].push(rule);
		classNameList.set(classname, true);
	}
}

function createThemeMedia() {
	if (themeCSS.dark.length) {
		let initial;
		initial = "@media (prefers-color-scheme: dark) {";
		for (let c of themeCSS.dark) {
			initial += c + "\n";
		}
		initial += "}";
		tempStyleList.push(initial);
		themeCSS.dark = [];
	}
	if (themeCSS.light.length) {
		let initial;
		initial = "@media (prefers-color-scheme: light) {";
		for (let c of themeCSS.light) {
			initial += c + "\n";
		}
		initial += "}";
		tempStyleList.push(initial);
		themeCSS.light = [];
	}
}

let saveTimeout; // Declare a variable to hold the timeout ID
function addNewRules() {
	for (let i = 0, len = tempStyleList.length; i < len; i++) {
		let rule = tempStyleList[i];

		let low = 0,
			high = parsedCSS.length;
		while (low < high) {
			let index = (low + high) >>> 1;
			let midItem = parsedCSS[index];
			if (rule < midItem) high = index;
			else low = index + 1;
		}

		if (low > styleElSheet.cssRules.length)
			low = styleElSheet.cssRules.length;
		try {
			styleElSheet.insertRule(rule, low);
			parsedCSS.splice(low, 0, rule);
		} catch (err) {
			console.error(err);
		}
	}

	if (tempStyleList.length > 0) {
		if (linkTag.save) {
			clearTimeout(saveTimeout); // Clear any existing timeout
			saveTimeout = setTimeout(() => {
				linkTag.save(); // Execute save after the delay
			}, 1000); // Delay of 1 second
		}
	}

	tempStyleList = [];
}

const observerInit = () => {
	observer.init({
		name: "ccCss",
		types: ["addedNodes"],
		selector: "[class]",
		callback: (mutation) => {
			if (parse != "false") initElements([mutation.target]);
		}
	});

	observer.init({
		name: "ccCss",
		types: ["attributes"],
		attributeFilter: ["class", "className"],
		callback: (mutation) => {
			if (parse != "false") initElements([mutation.target]);
		}
	});
};

observer.init({
	name: "cssParseAddedNode",
	types: ["addedNodes"],
	selector: "link[parse], link[save], link[object]",
	callback: (mutation) => {
		init([mutation.target]);
	}
});

observer.init({
	name: "cssParseattributes",
	types: ["attributes"],
	attributeFilter: ["parse", "save", "object"],
	selector: "link",
	callback: (mutation) => {
		init([mutation.target]);
	}
});

let linkTag = document.querySelector("link[parse], link[array][object][key]");
if (linkTag) init(linkTag);

export default { initElements };
