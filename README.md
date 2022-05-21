# Linear Workflow Status Action

Move stories from one status of a workflow to another.

## Inputs

### `linearApiKey`

_Required._ Linear API key.

### `fromStateId`

_Required._ Move from state id.

### `toStateId`

_Required._ Move to state id.

### `completedAfter`

_Optional._ Only picks issues completed after this Datetime

### `labelName`

_Optional._ The name of the label to add to the issues

## Outputs

### `label-created`

Was the label created.

### `url`

Label URL.

## Example usage

```yaml
uses: perdoo/linear-workflow-state-action@v0.1
with:
  linearApiKey: ${{ secrets.LINEAR_API_KEY }}
  fromStateId: 12345
  toStateId: 67890
```
