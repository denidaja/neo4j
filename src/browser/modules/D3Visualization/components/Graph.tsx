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
import { dim } from 'browser-styles/constants'
import graphView from '../lib/visualization/components/graphView'

import { deepEquals } from 'services/utils'
import {
  createGraph,
  getGraphStats,
  mapNodes,
  mapRelationships
} from '../mapper'
import { GraphEventHandler } from '../GraphEventHandler'
import '../lib/visualization/index'
import {
  StyledEditButton,
  StyledEditHolder,
  StyledSvgWrapper,
  StyledZoomButton,
  StyledZoomHolder,
  StyledConnectButton
} from './styled'
import {
  AddItemIcon,
  ConnectItemIcon,
  TrashItemIcon,
  ZoomInIcon,
  ZoomOutIcon
} from 'browser-components/icons/Icons'
import { optionalToString } from 'services/utils'

type State = any

const mapProperties = (_: any) =>
  Object.assign(
    {},
    ...Object.keys(_).map(k => ({ [k]: optionalToString(_[k]) }))
  )

export class GraphComponent extends Component<any, State> {
  graph: any
  graphEH: any
  graphView: any
  svgElement: any
  state = {
    zoomInLimitReached: true,
    zoomOutLimitReached: false,
    connectionSourceItem: null
  }

  graphInit(el: any) {
    this.svgElement = el
  }

  zoomInClicked(el: any) {
    const limits = this.graphView.zoomIn(el)
    this.setState({
      zoomInLimitReached: limits.zoomInLimit,
      zoomOutLimitReached: limits.zoomOutLimit
    })
  }

  zoomOutClicked(el: any) {
    const limits = this.graphView.zoomOut(el)
    this.setState({
      zoomInLimitReached: limits.zoomInLimit,
      zoomOutLimitReached: limits.zoomOutLimit
    })
  }

  trashItemClicked() {
    const item = this.props.selectedItem

    this.props.deleteItem(item).then((item: any) => {
      if (item.type === 'relationship') {
        this.deleteRelationship(item.item)
      } else {
        this.graphEH.nodeClose(item)
      }
    })
  }

  connectItemClicked() {
    const targetItem = this.props.selectedItem

    if (!this.state.connectionSourceItem) {
      this.setState({ connectionSourceItem: targetItem })
    } else {
      this.setState({ connectionSourceItem: null })
    }
  }

  addItemClicked() {
    this.props.addItem({ type: 'node' }).then(this.addPartialGraph.bind(this))
  }

  onItemSelect(item: any) {
    this.props.onItemSelect(item)

    if (this.state.connectionSourceItem) {
      this.props
        .connectItems(this.state.connectionSourceItem, item)
        .then(this.addPartialGraph.bind(this))
        .then(() => this.setState({ connectionSourceItem: null }))

      this.setState({ connectionSourceItem: null })
    }
  }

  addPartialGraph(graph: any) {
    this.graph.addNodes(mapNodes(graph.nodes))
    this.graph.addRelationships(
      mapRelationships(graph.relationships, this.graph)
    )

    if (graph.relationships.length === 1 && graph.nodes.length === 2) {
      this.graphEH.onRelationshipClicked(
        this.graph.findRelationship(graph.relationships[0].id)
      )
    } else if (graph.nodes.length === 1) {
      this.graphEH.nodeClicked(this.graph.findNode(graph.nodes[0].id))
    }

    this.graphEH.graphModelChanged()
  }

  deleteRelationship(item: any) {
    const relationship = this.graph.findRelationship(item.id)
    this.graph.removeRelationship(relationship)
    this.graphEH.propagateChange()
  }

  updateGraph(graph: any) {
    const lastSelection = this.graphEH.selectedItem
    this.graphEH.deselectItem()

    for (const update of graph.nodes) {
      const node = this.graph.findNode(update.id)

      node.propertyMap = mapProperties(update.properties)
      node.propertyList = [
        ...Object.keys(update.properties).map(k => ({
          key: k,
          value: update.properties[k]
        }))
      ]
      node.labels = update.labels
    }

    for (const update of graph.relationships) {
      const relationship = this.graph.findRelationship(update.id)
      relationship.propertyList = [
        ...Object.keys(update.properties).map(k => ({
          key: k,
          value: update.properties[k]
        }))
      ]
    }

    if (lastSelection && 'labels' in lastSelection) {
      this.graphEH.nodeClicked(lastSelection)
    } else {
      this.graphEH.onRelationshipClicked(lastSelection)
    }

    this.graphEH.graphModelChanged()
  }

  getVisualAreaHeight() {
    return this.props.frameHeight && this.props.fullscreen
      ? this.props.frameHeight -
          (dim.frameStatusbarHeight + dim.frameTitlebarHeight * 2)
      : this.props.frameHeight - dim.frameStatusbarHeight ||
          this.svgElement.parentNode.offsetHeight
  }

  componentDidMount() {
    if (this.svgElement != null) {
      this.initGraphView()
      this.graph && this.props.setGraph && this.props.setGraph(this.graph)
      this.props.getAutoCompleteCallback &&
        this.props.getAutoCompleteCallback(this.addInternalRelationships)
      this.props.assignVisElement &&
        this.props.assignVisElement(this.svgElement, this.graphView)
    }
  }

  initGraphView() {
    if (!this.graphView) {
      const NeoConstructor = graphView
      const measureSize = () => {
        return {
          width: this.svgElement.offsetWidth,
          height: this.getVisualAreaHeight()
        }
      }
      this.graph = createGraph(this.props.nodes, this.props.relationships)
      this.graphView = new NeoConstructor(
        this.svgElement,
        measureSize,
        this.graph,
        this.props.graphStyle
      )
      this.graphEH = new GraphEventHandler(
        this.graph,
        this.graphView,
        this.props.getNodeNeighbours,
        this.props.onItemMouseOver,
        this.onItemSelect.bind(this),
        this.props.onGraphModelChange
      )
      this.graphEH.bindEventHandlers()
      this.props.onGraphModelChange(getGraphStats(this.graph))
      this.graphView.resize()
      this.graphView.update()
    }
  }

  addInternalRelationships = (internalRelationships: any) => {
    if (this.graph) {
      this.graph.addInternalRelationships(
        mapRelationships(internalRelationships, this.graph)
      )
      this.props.onGraphModelChange(getGraphStats(this.graph))
      this.graphView.update()
      this.graphEH.onItemMouseOut()
    }
  }

  componentDidUpdate(prevProps: any) {
    if (prevProps.styleVersion !== this.props.styleVersion) {
      this.graphView.update()
    }
    if (
      this.props.fullscreen !== prevProps.fullscreen ||
      this.props.frameHeight !== prevProps.frameHeight
    ) {
      this.graphView.resize()
    }
  }

  zoomButtons() {
    return (
      <StyledZoomHolder>
        <StyledZoomButton
          className={
            this.state.zoomInLimitReached ? 'faded zoom-in' : 'zoom-in'
          }
          onClick={this.zoomInClicked.bind(this)}
        >
          <ZoomInIcon regulateSize={this.props.fullscreen ? 2 : 1} />
        </StyledZoomButton>
        <StyledZoomButton
          className={
            this.state.zoomOutLimitReached ? 'faded zoom-out' : 'zoom-out'
          }
          onClick={this.zoomOutClicked.bind(this)}
        >
          <ZoomOutIcon regulateSize={this.props.fullscreen ? 2 : 1} />
        </StyledZoomButton>
      </StyledZoomHolder>
    )
  }

  editButton() {
    const item = this.props.selectedItem
    const hasType = !!item
    const isCanvas = hasType && item['type'] === 'canvas'
    const isNode = hasType && item['type'] === 'node'
    const isInLinkMode = !!this.state.connectionSourceItem

    return (
      <StyledEditHolder>
        <StyledEditButton
          className={
            !isInLinkMode && hasType && !isCanvas ? 'bin' : 'faded bin'
          }
          onClick={() =>
            !isInLinkMode && hasType && !isCanvas && this.trashItemClicked()
          }
        >
          <TrashItemIcon />
        </StyledEditButton>
        <StyledConnectButton
          className={isNode ? 'link' : 'faded link'}
          onClick={() => isNode && this.connectItemClicked()}
        >
          <ConnectItemIcon />
        </StyledConnectButton>
        <StyledEditButton
          className={
            !isInLinkMode && (!hasType || isCanvas)
              ? 'add-circle'
              : 'faded add-circle'
          }
          onClick={() =>
            !isInLinkMode && (!hasType || isCanvas) && this.addItemClicked()
          }
        >
          <AddItemIcon />
        </StyledEditButton>
      </StyledEditHolder>
    )
  }

  render() {
    return (
      <StyledSvgWrapper>
        <svg className="neod3viz" ref={this.graphInit.bind(this)} />
        {this.editButton()}
        {this.zoomButtons()}
      </StyledSvgWrapper>
    )
  }
}
