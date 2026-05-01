export interface SubtagDef {
    id: string;
    name: string;
    color: string;
}

export interface TagDef {
    id: string;
    name: string;
    color: string;
    isSpecial?: boolean;
    showVerified?: boolean;
    verified?: boolean;
    subtags?: SubtagDef[];
}

export type TagRef = string;