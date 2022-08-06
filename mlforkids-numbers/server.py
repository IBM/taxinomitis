import os
import sys
import traceback
import cherrypy

import training




class Classify:
    exposed = True

    @cherrypy.tools.accept(media="application/json")

    def POST(self):
        if ("tenantid" not in cherrypy.request.json or
                "studentid" not in cherrypy.request.json or
                "projectid" not in cherrypy.request.json or
                "data" not in cherrypy.request.json):
            cherrypy.response.status = 400
            return { "error" : "Missing required input fields" }

        tenantid = cherrypy.request.json["tenantid"]
        studentid = cherrypy.request.json["studentid"]
        projectid = cherrypy.request.json["projectid"]
        data = cherrypy.request.json["data"]

        try:
            return training.classify(tenantid, studentid, projectid, data)
        except RuntimeError:
            cherrypy.response.status = 404
            print ("Runtime error:", sys.exc_info()[0])
            traceback.print_exc(file=sys.stdout)
            return { "error" : "Not found" }
        except Exception as e:
            cherrypy.response.status = 500
            print ("Unexpected error:", sys.exc_info()[0])
            print (projectid, studentid, tenantid)
            traceback.print_exc(file=sys.stdout)
            return { "error" : "bad", "details": str(e) }



class Models:
    exposed = True

    @cherrypy.tools.accept(media="application/json")

    def POST(self):
        if ("tenantid" not in cherrypy.request.json or
                "studentid" not in cherrypy.request.json or
                "projectid" not in cherrypy.request.json or
                "data" not in cherrypy.request.json):
            cherrypy.response.status = 400
            return { "error" : "Missing required input fields" }

        tenantid = cherrypy.request.json["tenantid"]
        studentid = cherrypy.request.json["studentid"]
        projectid = cherrypy.request.json["projectid"]
        trainingdata = cherrypy.request.json["data"]

        try:
            return training.trainNewClassifier(tenantid, studentid, projectid, trainingdata)
        except Exception as e:
            cherrypy.response.status = 500
            print ("Unexpected error:", sys.exc_info()[0])
            traceback.print_exc(file=sys.stdout)
            return { "error" : "bad", "details": str(e) }


    def DELETE(self, tenantid=None, studentid=None, projectid=None):
        if (tenantid is None):
            cherrypy.response.status = 400
            return { "error" : "Missing required input fields" }

        if studentid is None and projectid is None:
            training.deleteTenant(tenantid)
        elif projectid is None:
            training.deleteStudent(tenantid, studentid)
        else:
            training.deleteTraining(tenantid, studentid, projectid)

        return { "ok" : True }


    def GET(self, tenantid=None, studentid=None, projectid=None, formats="svg"):
        if tenantid is None or studentid is None or projectid is None:
            cherrypy.response.status = 400
            return { "error" : "Missing required input fields" }

        try:
            return training.describeModel(tenantid, studentid, projectid, formats.split(","))
        except RuntimeError:
            cherrypy.response.status = 404
            print ("Runtime error:", sys.exc_info()[0])
            traceback.print_exc(file=sys.stdout)
            return { "error" : "Not found" }
        except Exception as e:
            cherrypy.response.status = 500
            print ("Unexpected error:", sys.exc_info()[0])
            traceback.print_exc(file=sys.stdout)
            return { "error" : "bad" }






def validate_password(realm, username, password):
    return username == os.environ["VERIFY_USER"] and password == os.environ["VERIFY_PASSWORD"]


if __name__ == "__main__":

    if "VERIFY_USER" not in os.environ or "VERIFY_PASSWORD" not in os.environ:
        print("Missing required environment variables VERIFY_USER and VERIFY_PASSWORD")
        exit(-1)

    APICONFIG = {
        "/" : {
            "request.dispatch" : cherrypy.dispatch.MethodDispatcher(),
            "request.methods_with_bodies" : ("POST", "PUT"),
            "tools.response_headers.on" : True,
            "tools.response_headers.headers": [("Content-Type", "application/json")],
            "tools.gzip.on" : True,
            "tools.gzip.mime_types" : ["application/json"],
            "tools.json_in.on" : True,
            "tools.json_out.on" : True,
            "tools.auth_basic.on": True,
            "tools.auth_basic.realm": "localhost",
            "tools.auth_basic.checkpassword": validate_password
        }
    }


    cherrypy.tree.mount(Models(), "/api/models", APICONFIG)
    cherrypy.tree.mount(Classify(), "/api/classify", APICONFIG)


    PORT = int(os.getenv("PORT", 8000))
    HOST = "0.0.0.0"

    cherrypy.config.update({
        "server.socket_port" : PORT,
        "server.socket_host" : HOST,
    })

    print ("Starting server on %s:%d" % (HOST, PORT))

    cherrypy.engine.start()
    cherrypy.engine.block()
