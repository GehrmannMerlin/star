import { Type, type Static } from "@sinclair/typebox";
import { listRegions, type RegionNode } from "@stellaris/contracts";
import { ToolFailureCode, ToolFailureError } from "../../contracts/tool-failure-codes.js";
import type { AgentToolDefinition } from "../../contracts/tool-types.js";

export const GetRegionContextInput = Type.Object(
  {
    regionCode: Type.String({ pattern: "^[0-9]{6}$" }),
  },
  { additionalProperties: false },
);

export type GetRegionContextInput = Static<typeof GetRegionContextInput>;

export type RegionContextRef = {
  code: string;
  name: string;
  level: "province" | "city" | "county";
};

export type RegionContext = {
  regionCode: string;
  name: string;
  level: RegionContextRef["level"];
  parent: RegionContextRef | null;
  ancestors: RegionContextRef[];
};

const regionsByCode = new Map(listRegions().map((region) => [region.code, region]));

function toContextRef(region: RegionNode): RegionContextRef {
  if (region.level === "town") {
    throw new ToolFailureError({
      code: ToolFailureCode.INVALID_INPUT,
      message: "Town and street regions are outside this tool's current scope",
      retryable: false,
    });
  }
  return { code: region.code, name: region.name, level: region.level };
}

export const getRegionContextTool: AgentToolDefinition<
  typeof GetRegionContextInput,
  RegionContext
> = {
  name: "get_region_context",
  description: "Resolve a province, prefecture, or county code using the local region tree.",
  inputSchema: GetRegionContextInput,
  async execute(_context, input) {
    const region = regionsByCode.get(input.regionCode);
    if (!region) {
      throw new ToolFailureError({
        code: ToolFailureCode.REGION_NOT_FOUND,
        message: `Region not found: ${input.regionCode}`,
        retryable: false,
      });
    }

    const ancestors: RegionContextRef[] = [];
    let parent = region.parentCode ? regionsByCode.get(region.parentCode) : undefined;
    const directParent = parent ? toContextRef(parent) : null;
    while (parent) {
      ancestors.unshift(toContextRef(parent));
      parent = parent.parentCode ? regionsByCode.get(parent.parentCode) : undefined;
    }

    const self = toContextRef(region);
    return {
      regionCode: self.code,
      name: self.name,
      level: self.level,
      parent: directParent,
      ancestors,
    };
  },
};
