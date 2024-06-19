const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0zrlznh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//custom middleware
const verify = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden" });
  }
  // verify a token symmetric
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "forbidden" });
    }
    req.decoded = decoded;
    next();
  });
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Get the database and collection on which to run the operation
    const database = client.db("bisterDB");
    const menuCollection = database.collection("menu");
    const reviewsCollection = database.collection("reviews");
    const addtoCartCollection = database.collection("addtoCart");
    const usersCollection = database.collection("users");

    //genate a secret key require('crypto').randomBytes(64).toString('hex')

    //jwt related api methods
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        {
          user,
        },
        process.env.ACESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      res.send({ token });
    });

    //user related api methods
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const findUser = await usersCollection
        .find({ email: user.email })
        .toArray();
      if (findUser.length == 0) {
        const result = await usersCollection.insertOne(user);
        res.send(result);
      }
    });

    app.get("/users/admim/:email", async (req, res) => {
      const query = { email: req.params.email };
      const result = await usersCollection.find(query).toArray();
      const isAdmin = result.find((user) => user.role === "admin");
      isAdmin ? res.send(true) : res.send(false);
    });
    
    app.get("/users", verify, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.updateOne(query, { $set: req.body });
      res.send(result);
    });
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Get the database
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    app.get("/addtoCart", async (req, res) => {
      const queryEmail = req.query.email;
      const query = { email: queryEmail };
      const result = await addtoCartCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/addtoCart", async (req, res) => {
      const result = await addtoCartCollection.insertOne(req.body);
      res.send(result);
    });

    app.delete("/addtoCart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await addtoCartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//route
app.get("/", (req, res) => {
  res.send("bistro boss running");
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
