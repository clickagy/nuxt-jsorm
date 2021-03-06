/* eslint-disable */
import { SpraypaintBase } from 'spraypaint'
import orm from './models'

const deserializeModel = function ( { attributes, relationships, id, isPersisted, isMarkedForDestruction, isMarkedForDisassociation, errors, model } ) {
  let retRelationships = {}, attrs

  if ( Object.keys( relationships ).length > 0 ) {
    for ( const relationship in relationships ) {
      if ( typeof retRelationships[relationship] === 'undefined' ) {
        retRelationships[relationship] = []
      }

      const relatedItems = relationships[relationship]
      if ( Array.isArray( relatedItems ) ) {
        for ( const relatedItem in relatedItems ) {
          retRelationships[relationship].push( deserializeModel( relatedItems[relatedItem] ) )
        }
      } else {
        retRelationships[relationship] = deserializeModel( relatedItems )
      }
    }
    attrs = Object.assign( {}, attributes, retRelationships )
  } else {
    attrs = Object.assign( {}, attributes )
  }

  let ret = new orm[model]( attrs )
  ret.id = id
  ret.isPersisted = isPersisted
  ret.isMarkedForDestruction = isMarkedForDestruction
  ret.isMarkedForDisassociation = isMarkedForDisassociation
  ret.errors = Object.assign( {}, errors )

  return ret
}

const deserialize = function ( data, model ) {
  if ( isSpraypaintObject( data ) ) {
    if ( data.isSerializedByNuxtJSORM ) {
      data = deserializeModel( data, model )
    }
  } else if ( typeof data === "object" ) {
    for ( const item in data ) {
      if ( isSpraypaintObject( data[item] ) ) {
        if ( data[item].isSerializedByNuxtJSORM ) {
          data[item] = deserializeModel( data[item], model )
        }
      }
    }
  }

  return data
}

const serializeModel = function ( { attributes, relationships, id, isPersisted, isMarkedForDestruction, isMarkedForDisassociation, errors, getClassName } ) {
  let ret = {
    attributes: Object.assign( {}, attributes ),
    relationships: {},
    id,
    isPersisted,
    isMarkedForDestruction,
    isMarkedForDisassociation,
    isSerializedByNuxtJSORM: true,
    model: getClassName(),
    errors: Object.assign( {}, errors )
  }
  if ( Object.keys( relationships ).length < 1 ) {
    return ret
  }


  for ( const relationship in relationships ) {
    if ( typeof ret.relationships[relationship] === 'undefined' ) {
      ret.relationships[relationship] = []
    }
    const relatedItems = relationships[relationship]
    if ( Array.isArray( relatedItems ) ) {
      for ( const relatedItem in relatedItems ) {
        ret.relationships[relationship].push( serializeModel( relatedItems[relatedItem] ) )
      }
    } else {
      ret.relationships[relationship] = serializeModel( relatedItems )
    }
  }

  return ret
}

const isSpraypaintObject = function ( item ) {
  if ( typeof item !== "object" ) {
    return false
  }

  if ( typeof item.isSerializedByNuxtJSORM !== 'undefined' ) {
    return true
  }

  if ( item instanceof SpraypaintBase ) {
    return true
  }

  return false
}

const iterateAndSerializeStoreItems = function ( item, serializeFunction ) {
  let toIterate = []
  if ( Array.isArray( item ) ) {
    toIterate = item
  } else {
    toIterate = Object.keys( item )
  }
  toIterate.forEach( function ( key ) {
    if ( item[key] !== null ) {
      if ( typeof item[key] === 'object' ) {
        if ( isSpraypaintObject( item[key] ) ) {
          item[key] = serializeFunction( item[key] )
        } else {
          iterateAndSerializeStoreItems( item[key] );
          return;
        }
      } else if ( Array.isArray( item[key] ) ) {
        iterateAndSerializeStoreItems( item[key] );
      }
    }
  } );
}

const handleStoreHydration = function ( state, serializeFunction ) {
  let editedModules = []
  if ( serializeFunction == 'serialize' ) {
    serializeFunction = serializeModel
  } else {
    serializeFunction = deserializeModel
  }
  for ( const storeModule in state ) {
    const moduleState = state[storeModule]
    if ( typeof moduleState.jsorm !== "string" ) {
      continue
    }
    editedModules.push( storeModule )
    if ( typeof moduleState.jsormDeep !== 'undefined' && moduleState.jsormDeep ) {
      for ( const stateItemId in moduleState ) {
        if ( Array.isArray( moduleState[stateItemId] ) || typeof moduleState[stateItemId] === 'object' ) {
          iterateAndSerializeStoreItems( state[storeModule][stateItemId], serializeFunction )
        } else if ( isSpraypaintObject( moduleState[stateItemId] ) ) {
          state[storeModule][stateItemId] = serializeFunction( moduleState[stateItemId], moduleState.jsorm )
        }
      }
    } else {
      let somethingHydrated = false
      if ( typeof moduleState.by_account !== 'undefined' ) {
        for ( const accountId in moduleState.by_account ) {
          const accountData = moduleState.by_account[accountId]
          if ( typeof accountData[storeModule] === 'undefined' ) continue
          for ( const itemId in accountData[storeModule] ) {
            if ( !isSpraypaintObject( accountData[storeModule][itemId] ) ) {
              continue
            }
            somethingHydrated = true
            state[storeModule].by_account[accountId][storeModule][itemId] = serializeFunction( accountData[storeModule][itemId], moduleState.jsorm )
          }
        }
      }
      if ( typeof moduleState[storeModule] !== 'undefined' ) {
        for ( const itemId in moduleState[storeModule] ) {
          if ( !isSpraypaintObject( moduleState[storeModule][itemId] ) ) {
            continue
          }
          somethingHydrated = true
          state[storeModule][storeModule][itemId] = serializeFunction( moduleState[storeModule][itemId], moduleState.jsorm )
        }
      }
      if ( typeof moduleState.paginated !== 'undefined' ) {
        for ( const itemId in moduleState.paginated ) {
          if ( !isSpraypaintObject( moduleState.paginated[itemId] ) ) {
            continue
          }
          somethingHydrated = true
          state[storeModule].paginated[itemId] = serializeFunction( moduleState.paginated[itemId], moduleState.jsorm )
        }
      }
      if (!somethingHydrated) {
        for ( const itemId in moduleState ) {
          if ( !isSpraypaintObject( moduleState[itemId] ) ) {
            continue
          }
          state[storeModule][itemId] = serializeFunction( moduleState[itemId], moduleState.jsorm )
        }
      }
    }
  }
  return editedModules
}

const utils = { deserializeModel, deserialize, serializeModel, isSpraypaintObject, handleStoreHydration, iterateAndSerializeStoreItems }
export { deserializeModel, deserialize, serializeModel, isSpraypaintObject, handleStoreHydration, iterateAndSerializeStoreItems }
export default utils
