def serialize(userInputs) -> dict: 
  userInputs = userInputs.model_dump()
  return {**{i:str(userInputs[i])  for i in userInputs if i== "_id"}, **{ key: int(value)  for key, value in userInputs.items() if key != "id"}}


def serializers(inputs) -> list :
  return [ serialize(i) for i in inputs]