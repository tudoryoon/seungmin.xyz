export function remainingStations(stations, choices) {
  const used = new Set(choices.map(choice => choice.station_id));
  return stations.filter(station => !used.has(station.id));
}

export function createRouletteStore(client, identity) {
  function check(owner) {
    const current = identity();
    if (!owner.id || current.id !== owner.id || current.epoch !== owner.epoch) throw new Error('ACCOUNT_CHANGED');
  }
  async function list(table, order) {
    const owner = {...identity()}, rows = []; check(owner);
    for (let from = 0; ; from += 500) {
      const columns = 'station_id,station_name,lines,day,selected_at' + (table === 'roulette_cancellations' ? ',cancelled_at' : '');
      const {data,error} = await client.from(table).select(columns)
        .eq('user_id',owner.id).order(order,{ascending:false}).order('station_id').order('selected_at',{ascending:false}).range(from,from+499);
      check(owner); if (error) throw error;
      if (!Array.isArray(data)) throw new Error('INVALID_HISTORY');
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  return {
    list: () => list('roulette_choices', 'selected_at'),
    listCancelled: () => list('roulette_cancellations', 'cancelled_at'),
    async cancel(choice) {
      const owner = {...identity()}; check(owner);
      const {data,error} = await client.rpc('roulette_cancel', {
        p_station_id:choice.station_id,p_selected_at:choice.selected_at
      });
      check(owner); if (error) throw error;
      const row = Array.isArray(data) && data.length === 1 ? data[0] : data;
      if (!row || row.station_id !== choice.station_id || Date.parse(row.selected_at) !== Date.parse(choice.selected_at)
        || !Number.isFinite(Date.parse(row.cancelled_at))) throw new Error('INVALID_HISTORY');
      return row;
    },
    async choose(station) {
      const owner = {...identity()}; check(owner);
      const {data,error} = await client.rpc('roulette_choose', {
        p_station_id:station.id,p_station_name:station.name,p_lines:station.lines
      });
      check(owner); if (error) throw error;
      // PostgREST may wrap a composite return value in a one-row array.
      const choice = Array.isArray(data) && data.length === 1 ? data[0] : data;
      if (!choice || choice.station_id !== station.id || !/^\d{4}-\d{2}-\d{2}$/.test(choice.day)) throw new Error('INVALID_HISTORY');
      return choice;
    }
  };
}
