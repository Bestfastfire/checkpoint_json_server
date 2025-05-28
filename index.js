const jsonServer = require("json-server")
const path = require("path")
const fs = require("fs");

const server = jsonServer.create()
const router = jsonServer.router("db.json")
const middlewares = jsonServer.defaults()

server.use(middlewares)
server.use(jsonServer.bodyParser)

server.post('/reset', (req, res) => {
    const dbPath = path.join(__dirname, 'db_backup.json');
    const defaultDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    Object.keys(defaultDb).forEach((key) => {
        router.db.set(key, defaultDb[key]).write();
    });

    res.json({ status: 'reset', message: 'Banco de dados restaurado ao padrão.' });
});

server.post("/login", (req, res) => {
    const { id, senha } = req.body
    const db = router.db.getState()
    const user = db.usuarios.find((u) => u.id === Number.parseInt(id))

    if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" })
    }

    if (!user.senha || user.senha !== senha) {
        return res.status(401).json({ error: "Senha incorreta" })
    }

    const response = { message: "Login realizado com sucesso", user }
    console.log(`response: ${JSON.stringify(response)}`)
    res.json(response)
})

// ---------------- PONTO ----------------

// server.post("/ponto/ajuste", (req, res) => {
//     const ajuste = req.body
//     const db = router.db.getState()

//     ajuste.id = db.ponto.length + 1
//     db.ponto.push(ajuste)

//     router.db.setState(db)
//     res.json({ message: "Ajuste solicitado", ajuste })
// })

server.delete("/ponto/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()

    db.ponto = db.ponto.filter((p) => p.id !== id)
    router.db.setState(db)

    res.json({ message: "Ajuste cancelado" })
})

server.get('/ponto', (req, res) => {
    const db = router.db.getState();
    return res.json(db.ponto);
});

server.post('/ponto/ajuste', (req, res) => {
    const ajuste = req.body;
    const db = router.db.getState();

    // Encontra o registro pelo id
    const ponto = db.ponto.find(p => p.id === ajuste.id);


    if (!ponto) {
        return res.status(404).json({ message: 'Registro não encontrado' });
    }

    // Atualiza o registro com justificativa e status "pending"
    ponto.justify = ajuste.justify;
    ponto.status_request = 'pending';

    console.log('ponto', ponto);

    router.db.setState(db);
    router.db.write();

    res.json({ message: 'Ajuste solicitado', ponto });
});

// ---------------- USUÁRIOS ----------------
server.put("/usuarios/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()
    const user = db.usuarios.find((u) => u.id === id)

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" })

    Object.assign(user, req.body) // Atualiza todos os campos enviados

    router.db.setState(db)
    res.json({ message: "Usuário atualizado com sucesso", user })
})

server.get("/usuarios", (req, res) => {
    const db = router.db.getState()
    res.json(db.usuarios)
})

server.get("/usuarios/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()
    const user = db.usuarios.find((u) => u.id === id)

    if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" })
    }

    res.json(user)
})

server.delete("/usuarios/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()
    const user = db.usuarios.find((u) => u.id === id)

    if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" })
    }

    const novosUsuarios = db.usuarios.filter((u) => u.id !== id)
    router.db.setState({ ...db, usuarios: novosUsuarios })

    res.json({
        message: "Usuário excluído com sucesso",
    })
})

// Endpoint para criar um novo usuário
server.post("/usuarios", (req, res) => {
    const novoUsuario = req.body
    const db = router.db.getState()

    // Sempre gerar um novo ID em ordem crescente
    // Encontrar o maior ID atual
    let maxId = 0
    if (db.usuarios && db.usuarios.length > 0) {
        // Garantir que todos os IDs sejam tratados como números
        const ids = db.usuarios.map((u) => (typeof u.id === "number" ? u.id : Number.parseInt(u.id)))
        maxId = Math.max(...ids)
    }

    // Atribuir o próximo ID na sequência
    novoUsuario.id = maxId + 1

    // Adicionar o novo usuário à coleção
    db.usuarios.push(novoUsuario)
    router.db.setState(db)

    res.status(201).json({
        message: "Usuário criado com sucesso",
        usuario: novoUsuario,
    })
})

// ---------------- FÉRIAS ----------------
server.post("/ferias/solicitar", (req, res) => {
    const nova = req.body
    const db = router.db.getState()

    // Atribuição de id e status inicial
    nova.id = db.ferias.length ? db.ferias[db.ferias.length - 1].id + 1 : 1
    nova.status_request = "pending"
    db.ferias.push(nova)

    router.db.setState(db)
    res.json({ message: "Férias solicitadas com sucesso", data: nova })
})

server.get("/ferias", (req, res) => {
    const db = router.db.getState();
    const solicitacoes = db.solicitacoes.slice()
        .sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio))

    res.json(solicitacoes);
});

// ---------------- PENDING POINTS (APROVAÇÃO) ----------------
server.post("/pending_points/approve/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()
    const item = db.point_history.find((p) => p.id === id)

    if (!item) {
        return res.status(404).json({
            error: "ID Inválido",
        })
    }

    item.status_request = "approved"
    router.db.setState(db)
    res.json({
        message: "Requisição aprovada com sucesso",
    })
})

server.post("/pending_points/reprove/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()
    const item = db.point_history.find((p) => p.id === id)

    if (!item) {
        return res.status(404).json({
            error: "ID Inválido",
        })
    }

    item.status_request = "rejected"
    router.db.setState(db)

    res.json({
        message: "Requisição reprovada com sucesso",
    })
})

server.get("/pending_points/user/:id_company", (req, res) => {
    const db = router.db.getState()

    const companyId = Number.parseInt(req.params.id_company, 10)

    const pendingPoints = db.point_history
        .filter((p) => p.id_company === companyId && p.status_request === "pending")
        .map((pending) => {
            const user = db.usuarios.find((u) => u.id === pending.id_user)
            const day = db.working_days.find((d) => d.id === pending.id_working_day)
            const allPoints = db.point_history.filter(
                (p) => p.id_working_day === pending.id_working_day && p.id_user === user.id,
            )

            return {
                id: pending.id,
                user_name: user?.name || "Desconhecido",
                justify: pending.justify,
                date: day?.start_date,
                points: allPoints.map((p) => ({
                    id: p.id,
                    insert_origin: p.insert_origin,
                    status_request: p.status_request,
                    timestamp: p.timestamp,
                })),
            }
        })

    return res.json(pendingPoints)
})

// ---------------- FÉRIAS GERENCIAMENTO ----------------
// Endpoint para aprovar férias
server.post("/ferias/approve/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()
    const ferias = db.solicitacoes.find((f) => f.id === id)

    if (!ferias) {
        return res.status(404).json({ error: "Solicitação de férias não encontrada" })
    }

    ferias.status_request = "approved"
    router.db.setState(db)
    res.json({ message: "Férias aprovadas com sucesso", ferias })
})

// Endpoint para reprovar férias
server.post("/ferias/reject/:id", (req, res) => {
    const id = Number.parseInt(req.params.id)
    const db = router.db.getState()
    const ferias = db.solicitacoes.find((f) => f.id === id)

    if (!ferias) {
        return res.status(404).json({ error: "Solicitação de férias não encontrada" })
    }

    ferias.status_request = "rejected"
    router.db.setState(db)
    res.json({ message: "Férias reprovadas com sucesso", ferias })
})


server.get("/ferias/pendentes", (req, res) => {
    try{
        const db = router.db.getState()
        const feriasPendentes = db.solicitacoes.filter((f) => f.status_request === "pending")

        // Enriquecendo os dados com informações do usuário
        const feriasComUsuario = feriasPendentes.map((ferias) => {
            const usuario = db.usuarios.find((u) => u.id === ferias.id_user) || { nome: "Usuário não encontrado" }
            return {
                ...ferias,
                nome_usuario: usuario.nome,
                matricula: usuario.matricula || "",
            }
        })

        res.json(feriasComUsuario)
    }catch(error){
        console.error((error).stack);
    }
})


// ---------------- ROUTER FINAL ----------------
server.use(router)

server.listen(3001, () => {
    console.log("JSON Server unificado rodando em http://localhost:3001")
})
