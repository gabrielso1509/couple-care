'use strict';
// A chave fica nas variáveis de ambiente da Vercel, nunca no JavaScript público.
const P = require('../../lib/pluggy');
const consultas = { viagem: 'travel landscape', paris: 'Paris Eiffel Tower', casa: 'modern house exterior', casamento: 'wedding rings', praia: 'tropical beach', carro: 'car road', estudo: 'books study', reserva: 'savings coins', geral: 'mountain sunrise' };
module.exports = P.handler(async function (_sessao, body) {
    // Só aceitamos temas genéricos: nomes, valores e descrições privadas não são enviados ao Pexels.
    if (!Object.prototype.hasOwnProperty.call(consultas, body.tema)) P.fail(400, 'Tema inválido.');
    if (!process.env.PEXELS_API_KEY) P.fail(503, 'Imagens automáticas ainda não configuradas.');
    const url = 'https://api.pexels.com/v1/search?' + new URLSearchParams({query: consultas[body.tema], per_page: '1', orientation: 'landscape'});
    const resposta = await fetch(url, {headers:{Authorization:process.env.PEXELS_API_KEY},signal:AbortSignal.timeout(8000)});
    if (!resposta.ok) P.fail(502, 'Pesquisa de imagens indisponível.');
    const dados = await resposta.json();
    const foto = dados.photos?.[0];
    if (!foto) return {foto:null};
    return {foto:{id:foto.id,imagem:foto.src.medium,autor:foto.photographer,url:foto.url}};
});
