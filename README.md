# Linear Workflow Status Action

Move stories from one status of a workflow to another.

## Inputs

### `linearToken`

_Required._ Linear API key.

### `fromStateId`

_Required._ Move from state id.

### `toStateId`

_Required._ Move to state id.

### `label`

_Optional._ The name of a new label to be created and added to the issues.

## Outputs

### `url`

Label URL.

## Example usage

```yaml
uses: perdoo/linear-workflow-state-action@v0.4.0
with:
  linearApiKey: ${{ secrets.LINEAR_API_KEY }}
  fromStateId: 12345
  toStateId: 67890
```
