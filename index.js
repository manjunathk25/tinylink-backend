const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bodyParser = require('body-parser');
const cors = require('cors');
const { error } = require('three');
const app = express();
const port = process.env.PORT || 3000;

const prisma = new PrismaClient();

app.use(bodyParser.json());
app.use(cors());

app.get('/', (req, res) =>{
  res.send('Hello World!');
})

app.get('/api/healthz', (req, res) => {
  res.status(200).send('OK');
})

// Endpoint to create a new shortened link
app.post('/api/links', async (req, res) => {
  const { url, code } = req.body;

  if(!url){
    return res.status(400).json({ error: 'URL is required' });
  }

  try{
    if(code){
      const existing = await prisma.link.findUnique({where: {code}});
      if(existing){
        return res.status(409).json({error: 'Custom code already in use'});
      }
    }

    let generatedCode = () => Math.random().toString(36).substring(2, 8);
    let finalCode = code || generatedCode();

    while(await prisma.link.findUnique({where: {code: finalCode}})){
      finalCode = generatedCode();
    }

    const newLink = await prisma.link.create({
      data: {
        url,
        code: finalCode,
      }
    })
    res.status(201).json(newLink);
  }
  catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
});

// Endpoint to redirect to the original URL
app.get('/:code', async (req, res) => {
  const { code } = req.params;

  try{
    const link = await prisma.link.findUnique({where: {code}});

    if(!link || link.deleted){
      return res.status(404).json({error: 'Link not found'});
    }

    await prisma.link.update({
      where: {code},
      data: {
        clicks: {increment: 1},
        lastClicked: new Date()
      }
    })
    return res.redirect(302, link.url);
  }
  catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
})

//list all links
app.get('/api/links', async(req, res) => {
  try{
    const links = await prisma.link.findMany({
      where: {deleted: false},
      orderBy: {createdAt: 'desc'}
    });
    res.status(200).json(links);
  }
  catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
});

//get detailed stats of a specific link
app.get('/api/links/:code', async(req, res) => {
  const { code } = req.params;

  try{
    const link = await prisma.link.findUnique({where: {code}});

    if(!link || link.deleted){
      return res.status(404).json({error: 'link not found'});
    }
    res.status(200).json(link);
  }
  catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
});

//soft delete a link
app.delete('/api/links/:code', async(req, res) => {
  const { code } = req.params;

  try{
    const link = await prisma.link.findUnique({where: {code}});

    if(!link || link.deleted){
      return res.status(404).json({error: 'link not found'});
    }
    await prisma.link.update({
      where: {code},
      data: {deleted: true}
    });
    res.status(204).send();
  } 
  catch(err){
    console.error(err);
    res.status(500).json({error: 'Internal server error'});
  }
});

app.listen(port, () => {
  console.log(`tinylink app listening at http://localhost:${port}`);
});