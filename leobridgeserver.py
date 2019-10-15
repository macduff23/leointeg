import leo.core.leoBridge as leoBridge
import leo.core.leoNodes as leoNodes
import asyncio
import websockets
import sys
import os
import time
import json

# server defaults
websocketHost = "localhost"
websocketPort = 32125


class leoBridgeIntegController:
    '''Leo Bridge Controller'''

    def __init__(self):
        self.gnx_to_vnode = []  # utility array - see leoflexx.py in leoPluginsRef.leo
        self.bridge = leoBridge.controller(gui='nullGui',
                                           loadPlugins=False,  # True: attempt to load plugins.
                                           readSettings=True,  # True: read standard settings files.
                                           silent=True,      # True: don't print signon messages.
                                           verbose=False)     # True: print informational messages.
        self.currentActionId = 1  # Id of action being processed, STARTS AT 1 = Initial 'ready'
        # self.commander = None  # going to store the leo file commander once its opened from leo.core.leoBridge

    def setActionId(self, p_id):
        self.currentActionId = p_id

    def sendLeoBridgePackage(self, p_key=False, p_any=None):
        w_package = {"id": self.currentActionId}
        if p_key:
            w_package[p_key] = p_any  # add [key]?:any
        return(json.dumps(w_package))  # send as json

    def outputError(self, p_message="Unkown Error"):
        print("ERROR: " + p_message)  # Output to this server's running console
        w_package = {"id": self.currentActionId}
        w_package["error"] = p_message
        return p_message

    def outputBodyData(self, p_bodyText=""):
        return self.sendLeoBridgePackage("bodyData", p_bodyText)

    def outputPNode(self, p_node=False):
        if p_node:
            return self.sendLeoBridgePackage("node", self.p_to_ap(p_node))  # Single node, singular
        else:
            return self.sendLeoBridgePackage("node", None)

    def outputPNodes(self, p_pList):
        w_apList = []
        for p in p_pList:
            w_apList.append(self.p_to_ap(p))
        return self.sendLeoBridgePackage("nodes", w_apList)  # Multiple nodes, plural

    def test(self, p_param):
        '''Emit a test'''
        print('vsCode called test. Hello from leoBridge! your param was: ' + json.dumps(p_param))
        return self.sendLeoBridgePackage("package", "test string from the response package")

    def openFile(self, p_file):
        '''Open a leo file via leoBridge controller'''
        print("Trying to open file: "+p_file)
        self.commander = self.bridge.openLeoFile(p_file)  # create self.commander
        if(self.commander):
            self.create_gnx_to_vnode()
            return self.outputPNode(self.commander.p)
        else:
            return self.outputError('Error in openFile')

    def getPNode(self, p_ap):
        '''EMIT OUT a node, don't select it.'''
        if(p_ap):
            w_p = self.ap_to_p(p_ap)
            if w_p:
                return self.outputPNode(w_p)
            else:
                return self.outputError("Error in getPNode no w_p node found")  # default empty
        else:
            return self.outputError("Error in getPNode no param p_ap")

    def getChildren(self, p_ap):
        '''EMIT OUT list of children of a node'''
        if(p_ap):
            w_p = self.ap_to_p(p_ap)
            if w_p and w_p.hasChildren():
                return self.outputPNodes(w_p.children())
            else:
                return self.outputPNodes([])  # default empty array
        else:
            return self.outputPNodes(self.yieldAllRootChildren())  # this outputs all Root Children

    def getParent(self, p_ap):
        '''EMIT OUT the parent of a node, as an array, even if unique or empty'''
        if(p_ap):
            w_p = self.ap_to_p(p_ap)
            if w_p and w_p.hasParent():
                return self.outputPNode(w_p.getParent())
            else:
                return self.outputPNode()  # default empty for root
        else:
            return self.outputPNode()

    def getSelectedNode(self, p_param):
        '''EMIT OUT Selected Position as an array, even if unique'''
        if(self.commander.p):
            return self.outputPNode(self.commander.p)
        else:
            return self.outputPNode()

    def getBody(self, p_gnx):
        '''EMIT OUT body of a node'''
        if(p_gnx):
            w_v = self.commander.fileCommands.gnxDict.get(p_gnx)  # vitalije
            if w_v.b:
                return self.outputBodyData(w_v.b)
            else:
                return self.outputBodyData()  # default empty
        else:
            return self.outputBodyData()  # default empty

    def getBodyLength(self, p_gnx):
        '''EMIT OUT body string length of a node'''
        if(p_gnx):
            w_v = self.commander.fileCommands.gnxDict.get(p_gnx)  # vitalije
            if w_v and len(w_v.b):
                return self.sendLeoBridgePackage("bodyLenght", len(w_v.b))
            else:
                return self.sendLeoBridgePackage("bodyLenght", 0)
        else:
            return self.sendLeoBridgePackage("bodyLenght", 0)

    def setNewBody(self, p_body):
        '''Change Body of selected node'''
        if(self.commander.p):
            self.commander.p.b = p_body['body']
            return self.outputPNode(self.commander.p)
        else:
            return self.outputError("Error in setNewBody")

    def setBody(self, p_package):
        '''Change Headline of a node'''
        w_v = self.commander.fileCommands.gnxDict.get(p_package['gnx'])
        w_v.setBodyString(p_package['body'])
        if not w_v.isDirty():
            for w_p in self.commander.all_positions():
                if w_p.v == w_v:  # found
                    w_p.setDirty()
                    break
        return self.sendLeoBridgePackage()  # Just send empty as 'ok'

    def setNewHeadline(self, p_apHeadline):
        '''Change Headline of a node'''
        w_newHeadline = p_apHeadline['headline']
        w_ap = p_apHeadline['node']
        if(w_ap):
            w_p = self.ap_to_p(w_ap)
            if w_p:
                # set this node's new headline
                w_p.h = w_newHeadline
                return self.outputPNode(w_p)
        else:
            return self.outputError("Error in setNewHeadline")

    def setSelectedNode(self, p_ap):
        '''Select a node'''
        if(p_ap):
            w_p = self.ap_to_p(p_ap)
            if w_p:
                # set this node as selection
                self.commander.selectPosition(w_p)
        return self.sendLeoBridgePackage()  # Just send empty as 'ok'

    def expandNode(self, p_ap):
        '''Expand a node'''
        if(p_ap):
            w_p = self.ap_to_p(p_ap)
            if w_p:
                w_p.expand()
        return self.sendLeoBridgePackage()  # Just send empty as 'ok'

    def collapseNode(self, p_ap):
        '''Collapse a node'''
        if(p_ap):
            w_p = self.ap_to_p(p_ap)
            if w_p:
                w_p.contract()
        return self.sendLeoBridgePackage()  # Just send empty as 'ok'

    def create_gnx_to_vnode(self):
        '''Make the first gnx_to_vnode array with all unique nodes'''
        t1 = time.clock()
        self.gnx_to_vnode = {v.gnx: v for v in self.commander.all_unique_nodes()}
        # This is likely the only data that ever will be needed.
        if 0:
            print('app.create_all_data: %5.3f sec. %s entries' % (
                (time.clock()-t1), len(list(self.gnx_to_vnode.keys()))))
        self.test_round_trip_positions()

    def test_round_trip_positions(self):
        '''(From Leo plugin leoflexx.py) Test the round tripping of p_to_ap and ap_to_p.'''
        # Bug fix: p_to_ap updates app.gnx_to_vnode. Save and restore it.
        old_d = self.gnx_to_vnode.copy()
        old_len = len(list(self.gnx_to_vnode.keys()))
        t1 = time.clock()
        qtyAllPositions = 0
        for p in self.commander.all_positions():
            qtyAllPositions += 1
            ap = self.p_to_ap(p)
            p2 = self.ap_to_p(ap)
            assert p == p2, (repr(p), repr(p2), repr(ap))
        gnx_to_vnode = old_d
        new_len = len(list(gnx_to_vnode.keys()))
        assert old_len == new_len, (old_len, new_len)
        print('qtyAllPositions : ' + str(qtyAllPositions))
        print(('app.test_round_trip_positions: %5.3f sec for nodes total: ' % (time.clock()-t1))+str(qtyAllPositions))

    def yieldAllRootChildren(self):
        '''Return all root children P nodes'''
        p = self.commander.rootPosition()
        while p:
            yield p
            p.moveToNext()

    def ap_to_p(self, ap):
        '''(From Leo plugin leoflexx.py) Convert an archived position to a true Leo position.'''
        childIndex = ap['childIndex']
        v = self.gnx_to_vnode[ap['gnx']]
        stack = [
            (self.gnx_to_vnode[d['gnx']], d['childIndex'])
            for d in ap['stack']
        ]
        return leoNodes.position(v, childIndex, stack)

    def p_to_ap(self, p):
        '''(From Leo plugin leoflexx.py) Converts Leo position to a serializable archived position.'''
        if not p.v:
            print('app.p_to_ap: no p.v: %r %s' % (p))
            assert False
        p_gnx = p.v.gnx
        if p_gnx not in self.gnx_to_vnode:
            self.gnx_to_vnode[p_gnx] = p.v
        # * necessary properties for outline
        w_ap = {
            'childIndex': p._childIndex,
            'gnx': p.v.gnx,
            'level': p.level(),
            'headline': p.h,
            'stack': [{
                'gnx': stack_v.gnx,
                'childIndex': stack_childIndex,
                'headline': stack_v.h,
            } for (stack_v, stack_childIndex) in p.stack],
        }
        # TODO : (MAYBE) Convert all those bools into an integer 'status' Flags
        if bool(p.b):
            w_ap['hasBody'] = True
        if p.hasChildren():
            w_ap['hasChildren'] = True
        if p.isCloned():
            w_ap['cloned'] = True
        if p.isDirty():
            w_ap['dirty'] = True
        if p.isExpanded():
            w_ap['expanded'] = True
        if p.isMarked():
            w_ap['marked'] = True
        if p == self.commander.p:
            w_ap['selected'] = True
        return w_ap


# ! #######################
# ! #     SERVER LOOP     #
# ! #######################

def main():
    '''python script for leo integration via leoBridge'''
    global websocketHost, websocketPort
    print(
        "Starting leobridge server at " + websocketHost + " on port: " + str(websocketPort) + " [ctrl+c] to break",
        flush=True)

    integController = leoBridgeIntegController()

    # TODO : This is a basic test loop, fix it with 2 way async comm and error checking
    async def leoBridgeServer(websocket, path):
        await websocket.send(integController.sendLeoBridgePackage())  # * Start by just sending empty as 'ok'
        async for w_message in websocket:
            w_param = json.loads(w_message)
            if w_param and w_param['action']:
                # * Storing id of action in global var instead of passing as parameter
                integController.setActionId(w_param['id'])
                answer = getattr(integController, w_param['action'])(w_param['param'])
            else:
                print("Error in processCommand")
            await websocket.send(answer)

    start_server = websockets.serve(leoBridgeServer, websocketHost, websocketPort)

    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()


# Startup
if __name__ == '__main__':
    main()
