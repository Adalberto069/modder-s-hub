import { defineMcp } from "@lovable.dev/mcp-js";
import searchScripts from "./tools/search-scripts";
import getScript from "./tools/get-script";
import listTutorials from "./tools/list-tutorials";
import listBounties from "./tools/list-bounties";

export default defineMcp({
  name: "hiddenmod-mcp",
  title: "HiddenMod MCP",
  version: "0.1.0",
  instructions:
    "HiddenMod is a marketplace of Lua scripts for Game Guardian. Use `search_scripts` and `get_script` to browse marketplace scripts, `list_tutorials` to find Game Guardian / emulator / Lua tutorials, and `list_bounties` to see open script requests. All tools are read-only and return public catalog data.",
  tools: [searchScripts, getScript, listTutorials, listBounties],
});
