// To parse this data:
//
//   import { Convert, GoogleFontsVariable, GoogleFontsMeta } from "./file";
//
//   const googleFontsVariable = Convert.toGoogleFontsVariable(json);
//   const googleFontsMeta = Convert.toGoogleFontsMeta(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface GoogleFontsVariable {
    kind:  string;
    items: Item[];
}

export interface Item {
    family:             string;
    variants:           string[];
    subsets:            string[];
    version:            string;
    lastModified:       Date;
    files:              Files;
    category:           ItemCategory;
    kind:               Kind;
    menu:               string;
    axes?:              ItemAxis[];
    colorCapabilities?: ItemColorCapability[];
}

export interface ItemAxis {
    tag:   string;
    start: number;
    end:   number;
}

export enum ItemCategory {
    Display = "display",
    Handwriting = "handwriting",
    Monospace = "monospace",
    SansSerif = "sans-serif",
    Serif = "serif",
}

export enum ItemColorCapability {
    COLRv0 = "COLRv0",
    COLRv1 = "COLRv1",
    SVG = "SVG",
}

export interface Files {
    regular?:     string;
    italic?:      string;
    "500"?:       string;
    "600"?:       string;
    "700"?:       string;
    "800"?:       string;
    "900"?:       string;
    "500italic"?: string;
    "700italic"?: string;
    "800italic"?: string;
    "900italic"?: string;
    "100"?:       string;
    "300"?:       string;
    "100italic"?: string;
    "300italic"?: string;
    "200"?:       string;
    "200italic"?: string;
    "600italic"?: string;
}

export enum Kind {
    WebfontsWebfont = "webfonts#webfont",
}

export interface GoogleFontsMeta {
    axisRegistry:       AxisRegistry[];
    familyMetadataList: FamilyMetadataList[];
    promotedScript:     null;
}

export interface AxisRegistry {
    tag:              string;
    displayName:      string;
    min:              number;
    defaultValue:     number;
    max:              number;
    precision:        number;
    description:      string;
    fallbackOnly:     boolean;
    illustrationUrl?: string;
    fallbacks:        Fallback[];
}

export interface Fallback {
    name:        string;
    value:       number;
    displayName: DisplayName;
}

export enum DisplayName {
    Empty = "",
    Off = "Off",
    On = "On",
}

export interface FamilyMetadataList {
    family:            string;
    displayName:       null | string;
    category:          ClassificationEnum;
    stroke:            Stroke | null;
    classifications:   ClassificationEnum[];
    size:              number;
    subsets:           string[];
    fonts:             { [key: string]: Font };
    axes:              FamilyMetadataListAxis[];
    designers:         string[];
    lastModified:      Date;
    dateAdded:         Date;
    popularity:        number;
    trending:          number;
    defaultSort:       number;
    androidFragment:   null | string;
    isNoto:            boolean;
    colorCapabilities: FamilyMetadataListColorCapability[];
    primaryScript:     string;
    primaryLanguage:   PrimaryLanguage;
    isOpenSource:      boolean;
    isBrandFont:       boolean;
    languages:         any[];
}

export interface FamilyMetadataListAxis {
    tag:          string;
    min:          number;
    max:          number;
    defaultValue: number;
}

export enum ClassificationEnum {
    Display = "Display",
    Handwriting = "Handwriting",
    Monospace = "Monospace",
    SansSerif = "Sans Serif",
    Serif = "Serif",
    Symbols = "Symbols",
}

export enum FamilyMetadataListColorCapability {
    Colrv0 = "COLRV0",
    Colrv1 = "COLRV1",
    Otsvg = "OTSVG",
}

export interface Font {
    thickness:  number | null;
    slant:      number | null;
    width:      number | null;
    lineHeight: number;
}

export enum PrimaryLanguage {
    CSLatn = "cs_Latn",
    CuCyrl = "cu_Cyrl",
    DaLatn = "da_Latn",
    DeLatn = "de_Latn",
    Empty = "",
    EnLatn = "en_Latn",
    EsLatn = "es_Latn",
    FaArab = "fa_Arab",
    FrLatn = "fr_Latn",
    HrLatn = "hr_Latn",
    HuLatn = "hu_Latn",
    IDLatn = "id_Latn",
    IsLatn = "is_Latn",
    ItLatn = "it_Latn",
    NbLatn = "nb_Latn",
    NlLatn = "nl_Latn",
    PlLatn = "pl_Latn",
    PtLatn = "pt_Latn",
    RoLatn = "ro_Latn",
    SkLatn = "sk_Latn",
    ViLatn = "vi_Latn",
    YueHant = "yue_Hant",
    ZhHans = "zh_Hans",
    ZhHant = "zh_Hant",
}

export enum Stroke {
    SansSerif = "Sans Serif",
    Serif = "Serif",
    SlabSerif = "Slab Serif",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toGoogleFontsVariable(json: string): GoogleFontsVariable {
        return cast(JSON.parse(json), r("GoogleFontsVariable"));
    }

    public static googleFontsVariableToJson(value: GoogleFontsVariable): string {
        return JSON.stringify(uncast(value, r("GoogleFontsVariable")), null, 2);
    }

    public static toGoogleFontsMeta(json: string): GoogleFontsMeta {
        return cast(JSON.parse(json), r("GoogleFontsMeta"));
    }

    public static googleFontsMetaToJson(value: GoogleFontsMeta): string {
        return JSON.stringify(uncast(value, r("GoogleFontsMeta")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "GoogleFontsVariable": o([
        { json: "kind", js: "kind", typ: "" },
        { json: "items", js: "items", typ: a(r("Item")) },
    ], false),
    "Item": o([
        { json: "family", js: "family", typ: "" },
        { json: "variants", js: "variants", typ: a("") },
        { json: "subsets", js: "subsets", typ: a("") },
        { json: "version", js: "version", typ: "" },
        { json: "lastModified", js: "lastModified", typ: Date },
        { json: "files", js: "files", typ: r("Files") },
        { json: "category", js: "category", typ: r("ItemCategory") },
        { json: "kind", js: "kind", typ: r("Kind") },
        { json: "menu", js: "menu", typ: "" },
        { json: "axes", js: "axes", typ: u(undefined, a(r("ItemAxis"))) },
        { json: "colorCapabilities", js: "colorCapabilities", typ: u(undefined, a(r("ItemColorCapability"))) },
    ], false),
    "ItemAxis": o([
        { json: "tag", js: "tag", typ: "" },
        { json: "start", js: "start", typ: 3.14 },
        { json: "end", js: "end", typ: 3.14 },
    ], false),
    "Files": o([
        { json: "regular", js: "regular", typ: u(undefined, "") },
        { json: "italic", js: "italic", typ: u(undefined, "") },
        { json: "500", js: "500", typ: u(undefined, "") },
        { json: "600", js: "600", typ: u(undefined, "") },
        { json: "700", js: "700", typ: u(undefined, "") },
        { json: "800", js: "800", typ: u(undefined, "") },
        { json: "900", js: "900", typ: u(undefined, "") },
        { json: "500italic", js: "500italic", typ: u(undefined, "") },
        { json: "700italic", js: "700italic", typ: u(undefined, "") },
        { json: "800italic", js: "800italic", typ: u(undefined, "") },
        { json: "900italic", js: "900italic", typ: u(undefined, "") },
        { json: "100", js: "100", typ: u(undefined, "") },
        { json: "300", js: "300", typ: u(undefined, "") },
        { json: "100italic", js: "100italic", typ: u(undefined, "") },
        { json: "300italic", js: "300italic", typ: u(undefined, "") },
        { json: "200", js: "200", typ: u(undefined, "") },
        { json: "200italic", js: "200italic", typ: u(undefined, "") },
        { json: "600italic", js: "600italic", typ: u(undefined, "") },
    ], false),
    "GoogleFontsMeta": o([
        { json: "axisRegistry", js: "axisRegistry", typ: a(r("AxisRegistry")) },
        { json: "familyMetadataList", js: "familyMetadataList", typ: a(r("FamilyMetadataList")) },
        { json: "promotedScript", js: "promotedScript", typ: null },
    ], false),
    "AxisRegistry": o([
        { json: "tag", js: "tag", typ: "" },
        { json: "displayName", js: "displayName", typ: "" },
        { json: "min", js: "min", typ: 0 },
        { json: "defaultValue", js: "defaultValue", typ: 3.14 },
        { json: "max", js: "max", typ: 0 },
        { json: "precision", js: "precision", typ: 0 },
        { json: "description", js: "description", typ: "" },
        { json: "fallbackOnly", js: "fallbackOnly", typ: true },
        { json: "illustrationUrl", js: "illustrationUrl", typ: u(undefined, "") },
        { json: "fallbacks", js: "fallbacks", typ: a(r("Fallback")) },
    ], false),
    "Fallback": o([
        { json: "name", js: "name", typ: "" },
        { json: "value", js: "value", typ: 3.14 },
        { json: "displayName", js: "displayName", typ: r("DisplayName") },
    ], false),
    "FamilyMetadataList": o([
        { json: "family", js: "family", typ: "" },
        { json: "displayName", js: "displayName", typ: u(null, "") },
        { json: "category", js: "category", typ: r("ClassificationEnum") },
        { json: "stroke", js: "stroke", typ: u(r("Stroke"), null) },
        { json: "classifications", js: "classifications", typ: a(r("ClassificationEnum")) },
        { json: "size", js: "size", typ: 0 },
        { json: "subsets", js: "subsets", typ: a("") },
        { json: "fonts", js: "fonts", typ: m(r("Font")) },
        { json: "axes", js: "axes", typ: a(r("FamilyMetadataListAxis")) },
        { json: "designers", js: "designers", typ: a("") },
        { json: "lastModified", js: "lastModified", typ: Date },
        { json: "dateAdded", js: "dateAdded", typ: Date },
        { json: "popularity", js: "popularity", typ: 0 },
        { json: "trending", js: "trending", typ: 0 },
        { json: "defaultSort", js: "defaultSort", typ: 0 },
        { json: "androidFragment", js: "androidFragment", typ: u(null, "") },
        { json: "isNoto", js: "isNoto", typ: true },
        { json: "colorCapabilities", js: "colorCapabilities", typ: a(r("FamilyMetadataListColorCapability")) },
        { json: "primaryScript", js: "primaryScript", typ: "" },
        { json: "primaryLanguage", js: "primaryLanguage", typ: r("PrimaryLanguage") },
        { json: "isOpenSource", js: "isOpenSource", typ: true },
        { json: "isBrandFont", js: "isBrandFont", typ: true },
        { json: "languages", js: "languages", typ: a("any") },
    ], false),
    "FamilyMetadataListAxis": o([
        { json: "tag", js: "tag", typ: "" },
        { json: "min", js: "min", typ: 3.14 },
        { json: "max", js: "max", typ: 3.14 },
        { json: "defaultValue", js: "defaultValue", typ: 3.14 },
    ], false),
    "Font": o([
        { json: "thickness", js: "thickness", typ: u(0, null) },
        { json: "slant", js: "slant", typ: u(0, null) },
        { json: "width", js: "width", typ: u(0, null) },
        { json: "lineHeight", js: "lineHeight", typ: 3.14 },
    ], false),
    "ItemCategory": [
        "display",
        "handwriting",
        "monospace",
        "sans-serif",
        "serif",
    ],
    "ItemColorCapability": [
        "COLRv0",
        "COLRv1",
        "SVG",
    ],
    "Kind": [
        "webfonts#webfont",
    ],
    "DisplayName": [
        "",
        "Off",
        "On",
    ],
    "ClassificationEnum": [
        "Display",
        "Handwriting",
        "Monospace",
        "Sans Serif",
        "Serif",
        "Symbols",
    ],
    "FamilyMetadataListColorCapability": [
        "COLRV0",
        "COLRV1",
        "OTSVG",
    ],
    "PrimaryLanguage": [
        "cs_Latn",
        "cu_Cyrl",
        "da_Latn",
        "de_Latn",
        "",
        "en_Latn",
        "es_Latn",
        "fa_Arab",
        "fr_Latn",
        "hr_Latn",
        "hu_Latn",
        "id_Latn",
        "is_Latn",
        "it_Latn",
        "nb_Latn",
        "nl_Latn",
        "pl_Latn",
        "pt_Latn",
        "ro_Latn",
        "sk_Latn",
        "vi_Latn",
        "yue_Hant",
        "zh_Hans",
        "zh_Hant",
    ],
    "Stroke": [
        "Sans Serif",
        "Serif",
        "Slab Serif",
    ],
};
