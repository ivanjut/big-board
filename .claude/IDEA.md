# Summary
This is a web app designed to enable offline fantasy football drafts. The core functionality is a draft board where a privileged user can input fantasy football player picks as they are drafted.

System compatibility: This application should be a web application that is compatible with both computer and smart phone. 

## Desired workflow

### Draft creation
A fantasy football league commissioner can create a new draft instance which other league members can access in view-only mode by navigating to the draft instance specific URL, or joining that draft instance via UI. The instance should be password protected.

The following configuration should be available for the draft instance:
- Number of draft slots (e.g. 12)
- Number of rounds
- Names of each draft member and which position they are drafting
- Whether to include individual defensive players (IDPs)
- An optional time limit per selection

### Draft pick input
At the top should be a search bar where each pick can be dynamically searched to select a player. The players should exist in a database for easy and fast access. For example, to draft a player named "Bijan Robinson", the user can type something like "bij" or "rob" and have a fuzzy match list of players to choose from. Once a player is selected, the pick timer resets and the next pick is "on the clock".

There should be an undo button to go back to the previous selection, and a reset draft button that requires confirmation.

## UI Details
The draft board should have each drafting member's name in order at the top. Each row corresponds to a draft round. Each selection on the board being made should have its number displayed in the corresponding cell. When a player is drafted their name is shown with a small number next to it indicating the pick number.

