if (!sc.did_init) {
    if (!sc.didModules) {
        sc.memcpy = function(dst, src, size) { sc.call(utils.add2(sc.base, 0xF41B08), [dst, src, size]); }

        if (sc.nv.vers == "3.0.1") {
            sc.nv.modules.fatal.writePayloadAndPatch(0x167CB8); // 3.0.1
        } else if (sc.nv.vers == "4.0.1") {
            sc.nv.modules.fatal.writePayloadAndPatch(0x163278); // 4.0.1
        } else if (sc.nv.vers == "4.1.0") {
            sc.nv.modules.fatal.writePayloadAndPatch(0x163158); // 4.1.0
        }
        
        
        try {
            sc.ipcMsg(0).datau64(sc.nv.modules.fatal.getAslrBase()).setType(5).sendTo('fatal:u');
        } catch (rr) {
            sc.killAutoHandle('fatal:u');
            utils.log('Installed fatal!');
        }
        
        if (sc.nv.vers == "3.0.1") {
            sc.nv.modules.ns.writePayloadAndPatch(0x170ED8); // 3.0.1
        } else if (sc.nv.vers == "4.0.1" || sc.nv.vers == "4.1.0") {
            sc.nv.modules.ns.writePayloadAndPatch(0x190528); // 4.0.0
        }
        
        try{
            sc.ipcMsg(0).datau64(sc.nv.modules.ns.getAslrBase()).setType(5).sendTo('ns:vm');
        } catch (rr) {
            sc.killAutoHandle('ns:vm');
            utils.log('Installed NS!');
        }
        
        sc.lrHnd = sc.ipcMsg(301).datau64(0).sendTo('ns:vm').assertOk().show().movedHandles[0];
        
            sc.ipcMsg(0).datau32(3).sendTo(sc.lrHnd).asResult().andThen(res => {
            sc.withHandle(res.movedHandles[0], function(hnd) {
                var path = '@Sdcard://pegascape/caffeine.nsp';
                var pbuf = utils.str2ab(path + '\x00')
                sc.ipcMsg(1).datau64(utils.parseAddr('0100000000001008')).xDescriptor(pbuf, pbuf.byteLength).sendTo(hnd).assertOk().show();
                sc.nv.prepare_close();
                prompt("Tap the text field below, wait three seconds, then tap the power button.");
            });
        });
        sc.didModules = true;
    }

    //window.showAlbumMessage();
    
    /*
    //var path = getNCAPath(utils.parseAddr('010000000000B14A'));
    //utils.log('Manu path: '+path);
    sc.ipcMsg(300).datau64(0, [0xB14A, 0x01000000], 3, 0).sendTo('ns:vm').assertOk().show();

    sc.oldGetService = sc.getService;
    sc.getService = function (name, cb) {
        if (name === 'fatal:u') {
            return sc.oldGetService(name, cb);
        }
        if (typeof(name) !== "string") {
            throw new Error("cannot get service with non-string name");
        }
        if (!sc.hasService(name)) {
            throw new Error('no such service');
        }

        var lol = utils.str2u64(name);
        var r = sc.ipcMsg(4).datau64(lol).sendTo('fatal:u').asResult().map((response) => response.movedHandles[0]);
        if(cb === undefined) {
            return r;
        } else {
            var h = r.assertOk();
            try {
                return cb(h);
            } finally {
                sc.svcCloseHandle(h);
            }
        }
    };
    */

    sc.processes = {}
    sc.did_init = true;
}
