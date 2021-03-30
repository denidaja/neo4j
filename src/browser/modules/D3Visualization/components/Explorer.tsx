/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React, { Component } from 'react'
import deepmerge from 'deepmerge'
import { deepEquals } from 'services/utils'
import { GraphComponent } from './Graph'
import neoGraphStyle from '../graphStyle'
import { InspectorComponent } from './Inspector'
import { LegendComponent } from './Legend'
import { StyledFullSizeContainer } from './styled'
import { GlobalState } from 'shared/globalState'
import { getMaxFieldItems } from 'shared/modules/settings/settingsDuck'
import { connect } from 'react-redux'

import { withBus } from 'react-suber'
import {
  EditPropertyForm,
  EditRelationshipTypeForm,
  AddNodeLabelForm
} from './EditForm'

const deduplicateNodes = (nodes: any) => {
  return nodes.reduce(
    (all: any, curr: any) => {
      if (all.taken.indexOf(curr.id) > -1) {
        return all
      } else {
        all.nodes.push(curr)
        all.taken.push(curr.id)
        return all
      }
    },
    { nodes: [], taken: [] }
  ).nodes
}

type ExplorerComponentState = any

export class ExplorerComponent extends Component<any, ExplorerComponentState> {
  defaultStyle: any
  graphComponent: any

  constructor(props: any) {
    super(props)
    const graphStyle = neoGraphStyle()
    this.defaultStyle = graphStyle.toSheet()
    let relationships = this.props.relationships
    let nodes = deduplicateNodes(this.props.nodes)
    let selectedItem: any = ''
    if (nodes.length > parseInt(this.props.initialNodeDisplay)) {
      nodes = nodes.slice(0, this.props.initialNodeDisplay)
      relationships = this.props.relationships.filter((item: any) => {
        return nodes.filter((node: any) => node.id === item.startNodeId) > 0
      })
      selectedItem = {
        type: 'status-item',
        item: `Not all return nodes are being displayed due to Initial Node Display setting. Only ${this.props.initialNodeDisplay} of ${nodes.length} nodes are being displayed`
      }
    }
    if (this.props.graphStyleData) {
      const rebasedStyle = deepmerge(
        this.defaultStyle,
        this.props.graphStyleData
      )
      graphStyle.loadRules(rebasedStyle)
    }
    this.state = {
      showForm: false,
      stats: { labels: {}, relTypes: {} },
      graphStyle,
      styleVersion: 0,
      nodes,
      relationships,
      selectedItem
    }

    this.graphComponent = React.createRef()
  }

  getNodeNeighbours(node: any, currentNeighbours: any, callback: any) {
    if (currentNeighbours.length > this.props.maxNeighbours) {
      callback(null, { nodes: [], relationships: [] })
    }
    this.props.getNeighbours(node.id, currentNeighbours).then(
      (result: any) => {
        const nodes = result.nodes
        if (
          result.count >
          this.props.maxNeighbours - currentNeighbours.length
        ) {
          this.setState({
            selectedItem: {
              type: 'status-item',
              item: `Rendering was limited to ${
                this.props.maxNeighbours
              } of the node's total ${result.count +
                currentNeighbours.length} neighbours due to browser config maxNeighbours.`
            }
          })
        }
        callback(null, { nodes: nodes, relationships: result.relationships })
      },
      () => {
        callback(null, { nodes: [], relationships: [] })
      }
    )
  }

  onItemMouseOver(item: any) {
    this.setState({ hoveredItem: item })
  }

  onItemSelect(item: any) {
    this.setState({ selectedItem: item })
  }

  deleteItem(item: any): any {
    return this.props.deleteItem(item)
  }

  addItem(item: any): any {
    return this.props.addItem(item)
  }

  connectItems(source: any, target: any): any {
    return this.props.connectItems(source, target)
  }

  onGraphModelChange(stats: any) {
    this.setState({ stats: stats })
    this.props.updateStyle(this.state.graphStyle.toSheet())
  }

  onSelectedLabel(label: any, propertyKeys: any) {
    this.setState({
      selectedItem: {
        type: 'legend-item',
        item: {
          selectedLabel: { label: label, propertyKeys: propertyKeys },
          selectedRelType: null
        }
      }
    })
  }

  onSelectedRelType(relType: any, propertyKeys: any) {
    this.setState({
      selectedItem: {
        type: 'legend-item',
        item: {
          selectedLabel: null,
          selectedRelType: { relType: relType, propertyKeys: propertyKeys }
        }
      }
    })
  }

  componentDidUpdate(prevProps: any) {
    if (!deepEquals(prevProps.graphStyleData, this.props.graphStyleData)) {
      if (this.props.graphStyleData) {
        const rebasedStyle = deepmerge(
          this.defaultStyle,
          this.props.graphStyleData
        )
        this.state.graphStyle.loadRules(rebasedStyle)
        this.setState({
          graphStyle: this.state.graphStyle,
          styleVersion: this.state.styleVersion + 1
        })
      } else {
        this.state.graphStyle.resetToDefault()
        this.setState(
          { graphStyle: this.state.graphStyle, freezeLegend: true },
          () => {
            this.setState({ freezeLegend: false })
            this.props.updateStyle(this.state.graphStyle.toSheet())
          }
        )
      }
    }
  }

  onInspectorExpandToggled(contracted: any, inspectorHeight: any) {
    this.setState({
      inspectorContracted: contracted,
      forcePaddingBottom: inspectorHeight
    })
  }

  onAddProperty() {
    this.setState({ showForm: 'addProperty' })
  }

  onEditProperty(key: any, value: any): any {
    this.setState({
      showForm: 'editProperty',
      propertyKey: key,
      propertyValue: value
    })
  }

  onRemoveProperty(key: any): any {
    const graph = this.graphComponent.current

    this.props
      .removeItemProperty(this.state.selectedItem, key)
      .then(graph.updateGraph.bind(graph))
  }

  onRemoveLabel(label: any): any {
    const graph = this.graphComponent.current

    this.props
      .removeNodeLabel(this.state.selectedItem, label)
      .then(graph.updateGraph.bind(graph))
  }

  onEditRelationshipType(type: any): any {
    this.setState({
      showForm: 'editRelationshipType',
      relationshipType: type
    })
  }

  onAddLabel(): any {
    this.setState({ showForm: 'addLabel' })
  }

  setTypeOnSelectedRelationship(data: any): any {
    const graph = this.graphComponent.current

    this.props
      .setRelationshipType(this.state.selectedItem, data.relationshipType)
      .then((result: any): any => {
        const old = result.relationships.reverse().shift()
        graph.addPartialGraph(result)
        graph.deleteRelationship(old)
      })
  }

  setPropertyOnSelectedItem(data: any): any {
    const graph = this.graphComponent.current

    this.props
      .setItemProperty(this.state.selectedItem, data.key, data.value)
      .then(graph.updateGraph.bind(graph))
  }

  addLabelToSelectedItem(data: any): any {
    const graph = this.graphComponent.current

    this.props
      .addNodeLabel(this.state.selectedItem, data.label)
      .then((result: any): any => {
        graph.updateGraph(result)
      })
  }

  modalForm() {
    const propertyKey = this.state.propertyKey
    const propertyValue = this.state.propertyValue
    const relationshipType = this.state.relationshipType

    switch (this.state.showForm) {
      case 'addProperty':
        return (
          <EditPropertyForm
            onClose={() => this.setState({ showForm: false })}
            onSubmit={this.setPropertyOnSelectedItem.bind(this)}
            values={{ key: '', value: '' }}
          />
        )

      case 'editProperty':
        return (
          <EditPropertyForm
            onClose={() => this.setState({ showForm: false })}
            onSubmit={this.setPropertyOnSelectedItem.bind(this)}
            values={{ key: propertyKey, value: propertyValue }}
          />
        )

      case 'editRelationshipType':
        return (
          <EditRelationshipTypeForm
            onClose={() => this.setState({ showForm: false })}
            onSubmit={this.setTypeOnSelectedRelationship.bind(this)}
            values={{ relationshipType: relationshipType }}
          />
        )

      case 'addLabel':
        return (
          <AddNodeLabelForm
            onClose={() => this.setState({ showForm: false })}
            onSubmit={this.addLabelToSelectedItem.bind(this)}
          />
        )
      default:
        return (
          <AddNodeLabelForm
            onClose={() => this.setState({ showForm: false })}
            onSubmit={this.addLabelToSelectedItem.bind(this)}
          />
        )
    }
  }

  render() {
    // This is a workaround to make the style reset to the same colors as when starting the browser with an empty style
    // If the legend component has the style it will ask the neoGraphStyle object for styling before the graph component,
    // and also doing this in a different order from the graph. This leads to different default colors being assigned to different labels.
    let legend
    if (this.state.freezeLegend) {
      legend = (
        <LegendComponent
          stats={this.state.stats}
          graphStyle={neoGraphStyle()}
          onSelectedLabel={this.onSelectedLabel.bind(this)}
          onSelectedRelType={this.onSelectedRelType.bind(this)}
        />
      )
    } else {
      legend = (
        <LegendComponent
          stats={this.state.stats}
          graphStyle={this.state.graphStyle}
          onSelectedLabel={this.onSelectedLabel.bind(this)}
          onSelectedRelType={this.onSelectedRelType.bind(this)}
        />
      )
    }
    const inspectingItemType =
      !this.state.inspectorContracted &&
      ((this.state.hoveredItem && this.state.hoveredItem.type !== 'canvas') ||
        (this.state.selectedItem && this.state.selectedItem.type !== 'canvas'))

    return (
      <StyledFullSizeContainer
        id="svg-vis"
        className={
          Object.keys(this.state.stats.relTypes).length ? '' : 'one-legend-row'
        }
        forcePaddingBottom={
          inspectingItemType ? this.state.forcePaddingBottom : null
        }
      >
        {legend}
        <GraphComponent
          fullscreen={this.props.fullscreen}
          frameHeight={this.props.frameHeight}
          relationships={this.state.relationships}
          nodes={this.state.nodes}
          getNodeNeighbours={this.getNodeNeighbours.bind(this)}
          onItemMouseOver={this.onItemMouseOver.bind(this)}
          onItemSelect={this.onItemSelect.bind(this)}
          deleteItem={this.deleteItem.bind(this)}
          addItem={this.addItem.bind(this)}
          connectItems={this.connectItems.bind(this)}
          graphStyle={this.state.graphStyle}
          styleVersion={this.state.styleVersion} // cheap way for child to check style updates
          onGraphModelChange={this.onGraphModelChange.bind(this)}
          assignVisElement={this.props.assignVisElement}
          getAutoCompleteCallback={this.props.getAutoCompleteCallback}
          setGraph={this.props.setGraph}
          selectedItem={this.state.selectedItem}
          ref={this.graphComponent}
        />
        <InspectorComponent
          hasTruncatedFields={this.props.hasTruncatedFields}
          fullscreen={this.props.fullscreen}
          hoveredItem={this.state.hoveredItem}
          selectedItem={this.state.selectedItem}
          graphStyle={this.state.graphStyle}
          onExpandToggled={this.onInspectorExpandToggled.bind(this)}
          onAddProperty={this.onAddProperty.bind(this)}
          onAddLabel={this.onAddLabel.bind(this)}
          onEditProperty={this.onEditProperty.bind(this)}
          onEditRelationshipType={this.onEditRelationshipType.bind(this)}
          onRemoveProperty={this.onRemoveProperty.bind(this)}
          onRemoveLabel={this.onRemoveLabel.bind(this)}
        />
        {this.state.showForm && this.modalForm()}
      </StyledFullSizeContainer>
    )
  }
}
export const Explorer = connect((state: GlobalState) => ({
  maxFieldItems: getMaxFieldItems(state)
}))(ExplorerComponent)
export const ExplorerComponentWithBus = withBus(ExplorerComponent)
