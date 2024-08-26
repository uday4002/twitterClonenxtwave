const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())

const dbpath = path.join(__dirname, 'twitterClone.db')
let db = null

const secrectKey = 'hdsgfuaewbfhbubfsjbfib'

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running...')
    })
  } catch (e) {
    console.log(DB Error ${e.message})
  }
}

initializeDBAndServer()

const checkToken = async (requset, response, next) => {
  const header = requset.headers['authorization']
  let token
  if (header !== undefined) {
    token = header.split(' ')[1]
  }
  if (token === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(token, secrectKey, (err, payload) => {
      if (err) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        requset.payload = payload
        next()
      }
    })
  }
}

app.post('/register', async (request, response) => {
  const {username, password, name, gender} = request.body
  const selectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selectUserQuery)
  if (dbUser !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const createUserQuery = `
            INSERT INTO user(username,password,name,gender)
            VALUES ('${username}','${hashedPassword}','${name}','${gender}');
            `
      await db.run(createUserQuery)
      response.status(200)
      response.send('User created successfully')
    }
  }
})

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password)
    if (isPasswordCorrect === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, secrectKey)
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/user/tweets/feed', checkToken, async (request, response) => {
  const {username} = request.payload
  const selectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selectUserQuery)
  const userId = dbUser.user_id
  const getFollowingUserIdsQuery = `
  SELECT * FROM follower WHERE follower_user_id='${userId}';
  `
  const userFollowingArray = await db.all(getFollowingUserIdsQuery)

  const followingUserIds = userFollowingArray.map(
    object => object.following_user_id,
  )
  if (followingUserIds.length > 0) {
    const tweetsQuery = `
    SELECT username,tweet,date_time AS dateTime FROM tweet NATURAL JOIN user
    WHERE tweet.user_id IN (${followingUserIds}) LIMIT 4 OFFSET 0;
    `
    const tweetsArray = await db.all(tweetsQuery)
    response.send(tweetsArray)
  } else {
    response.send([])
  }
})

app.get('/user/following', checkToken, async (request, response) => {
  const {username} = request.payload
  const selsectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selsectUserQuery)
  const userId = dbUser.user_id
  const getFollowingUserIdsQuery = `
  SELECT * FROM follower WHERE follower_user_id='${userId}';
  `
  const userFollowingArray = await db.all(getFollowingUserIdsQuery)

  const followingUserIds = userFollowingArray.map(
    object => object.following_user_id,
  )
  if (followingUserIds.length > 0) {
    const getUsernameQuery = `
    SELECT name FROM user WHERE user_id IN (${followingUserIds});
    `
    const users = await db.all(getUsernameQuery)
    response.send(users)
  } else {
    response.send([])
  }
})

app.get('/user/followers', checkToken, async (request, response) => {
  const {username} = request.payload
  const selsectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selsectUserQuery)
  const userId = dbUser.user_id
  const getFollowerUserIdsQuery = `
  SELECT * FROM follower WHERE following_user_id='${userId}';
  `
  const userFollowersArray = await db.all(getFollowerUserIdsQuery)

  const followerUserIds = userFollowersArray.map(
    object => object.follower_user_id,
  )
  if (followerUserIds.length > 0) {
    const getUsernameQuery = `
    SELECT name FROM user WHERE user_id IN (${followerUserIds});
    `
    const users = await db.all(getUsernameQuery)
    response.send(users)
  } else {
    response.send([])
  }
})

app.get('/tweets/:tweetId', checkToken, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request.payload
  const selsectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selsectUserQuery)
  const userId = dbUser.user_id
  const getFollowingUserIdsQuery = `
  SELECT * FROM follower WHERE follower_user_id='${userId}';
  `
  const userFollowingArray = await db.all(getFollowingUserIdsQuery)

  const followingUserIds = userFollowingArray.map(
    object => object.following_user_id,
  )
  if (followingUserIds.length > 0) {
    const tweetQuery = `
    SELECT t.tweet,COUNT(l.like_id) AS likes,COUNT(r.reply_id) AS replies,t.date_time AS dateTime
    FROM tweet t
    LEFT JOIN like l ON t.tweet_id=l.tweet_id
    LEFT JOIN reply r ON t.tweet_id=r.tweet_id
    WHERE 
    t.user_id IN (${followingUserIds}) AND t.tweet_id=${tweetId}
    GROUP BY 
    t.tweet_id
    `
    const tweet = await db.get(tweetQuery)
    if (tweet === undefined) {
      response.status(401)
      response.send('Invalid Request')
    }

    response.send(tweet)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

app.get('/tweets/:tweetId/likes', checkToken, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request.payload
  const selsectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selsectUserQuery)
  const userId = dbUser.user_id
  const getFollowingUserIdsQuery = `
  SELECT * FROM follower WHERE follower_user_id='${userId}';
  `
  const userFollowingArray = await db.all(getFollowingUserIdsQuery)

  const followingUserIds = userFollowingArray.map(
    object => object.following_user_id,
  )
  if (followingUserIds.length > 0) {
    const getLikesUserIdsQuery = `
    SELECT like.user_id FROM like LEFT JOIN tweet ON like.tweet_id=tweet.tweet_id
    WHERE 
    tweet.tweet_id=${tweetId} AND tweet.user_id IN (${followingUserIds});
    `
    const userIdsData = await db.all(getLikesUserIdsQuery)
    const userIds = userIdsData.map(object => object.user_id)
    if (userIds.length === 0) {
      response.status(401)
      response.send('Invalid Request')
      return
    }
    const getUserNamesQuery = `
    SELECT username FROM user WHERE user_id IN (${userIds})
    `
    const userNames = await db.all(getUserNamesQuery)
    let likesNames = []
    userNames.map(item => {
      likesNames.push(item.username)
    })
    if (likesNames.length === 0) {
      response.status(401)
      response.send('Invalid Request')
    }

    response.send({likes: likesNames})
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

app.get('/tweets/:tweetId/replies', checkToken, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request.payload
  const selsectUserQuery = `
    SELECT * FROM user WHERE username='${username}';
    `
  const dbUser = await db.get(selsectUserQuery)
  const userId = dbUser.user_id
  const getFollowingUserIdsQuery = `
  SELECT * FROM follower WHERE follower_user_id='${userId}';
  `
  const userFollowingArray = await db.all(getFollowingUserIdsQuery)

  const followingUserIds = userFollowingArray.map(
    object => object.following_user_id,
  )
  if (followingUserIds.length > 0) {
    const getRepliesUserIdsQuery = `
    SELECT reply.user_id,reply.reply FROM reply LEFT JOIN tweet ON reply.tweet_id=tweet.tweet_id
    WHERE 
    tweet.tweet_id=${tweetId} AND tweet.user_id IN (${followingUserIds});
    `
    const userIdsData = await db.all(getRepliesUserIdsQuery)
    const userIds = userIdsData.map(object => object.user_id)
    if (userIds.length === 0) {
      response.status(401)
      response.send('Invalid Request')
      return
    }
    const getUserNamesQuery = `
    SELECT username FROM user WHERE user_id IN (${userIds})
    `
    const userNames = await db.all(getUserNamesQuery)

    response.send({replies: userNames})
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})